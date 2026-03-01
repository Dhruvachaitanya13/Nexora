from sqlalchemy import create_engine, event, text, pool, exc
from sqlalchemy.orm import sessionmaker, Session, scoped_session
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import QueuePool, NullPool, StaticPool
from sqlalchemy.exc import OperationalError, DisconnectionError, InterfaceError, DatabaseError
from contextlib import contextmanager, asynccontextmanager
from typing import Generator, AsyncGenerator, Optional, Dict, Any, Callable
from functools import wraps
import time
import logging
import threading
import asyncio
from datetime import datetime
import json

from app.core.config import settings

logger = logging.getLogger(__name__)


class DatabaseMetrics:
    def __init__(self):
        self._lock = threading.Lock()
        self._metrics = {
            "total_connections": 0,
            "active_connections": 0,
            "idle_connections": 0,
            "total_queries": 0,
            "slow_queries": 0,
            "failed_queries": 0,
            "connection_errors": 0,
            "pool_overflow": 0,
            "pool_timeout": 0,
            "last_health_check": None,
            "health_check_status": None,
            "avg_query_time_ms": 0.0,
            "max_query_time_ms": 0.0,
            "queries_per_second": 0.0,
        }
        self._query_times = []
        self._query_count_window = []
    
    def increment(self, metric: str, value: int = 1):
        with self._lock:
            if metric in self._metrics:
                self._metrics[metric] += value
    
    def set(self, metric: str, value: Any):
        with self._lock:
            self._metrics[metric] = value
    
    def record_query_time(self, time_ms: float):
        with self._lock:
            self._query_times.append(time_ms)
            if len(self._query_times) > 1000:
                self._query_times = self._query_times[-1000:]
            
            self._metrics["total_queries"] += 1
            if time_ms > 1000:
                self._metrics["slow_queries"] += 1
            
            if self._query_times:
                self._metrics["avg_query_time_ms"] = sum(self._query_times) / len(self._query_times)
                self._metrics["max_query_time_ms"] = max(self._query_times)
            
            now = time.time()
            self._query_count_window.append(now)
            self._query_count_window = [t for t in self._query_count_window if t > now - 60]
            self._metrics["queries_per_second"] = len(self._query_count_window) / 60.0
    
    def get_metrics(self) -> Dict[str, Any]:
        with self._lock:
            return self._metrics.copy()
    
    def reset(self):
        with self._lock:
            for key in self._metrics:
                if isinstance(self._metrics[key], (int, float)):
                    self._metrics[key] = 0
            self._query_times = []
            self._query_count_window = []


db_metrics = DatabaseMetrics()


class ConnectionPool:
    def __init__(self, pool_instance):
        self._pool = pool_instance
    
    def status(self) -> Dict[str, Any]:
        return {
            "pool_size": self._pool.size(),
            "checked_out": self._pool.checkedout(),
            "overflow": self._pool.overflow(),
            "checked_in": self._pool.checkedin(),
            "invalid": self._pool.invalidatedcount() if hasattr(self._pool, 'invalidatedcount') else 0,
        }
    
    def dispose(self):
        self._pool.dispose()
    
    def recreate(self):
        self._pool.recreate()


def get_pool_class(pool_type: str = "queue"):
    pool_classes = {
        "queue": QueuePool,
        "null": NullPool,
        "static": StaticPool,
    }
    return pool_classes.get(pool_type, QueuePool)


def create_database_url(
    host: str = None,
    port: int = None,
    user: str = None,
    password: str = None,
    database: str = None,
    driver: str = "postgresql",
) -> str:
    host = host or settings.db.POSTGRES_HOST
    port = port or settings.db.POSTGRES_PORT
    user = user or settings.db.POSTGRES_USER
    password = password or settings.db.POSTGRES_PASSWORD
    database = database or settings.db.POSTGRES_DB
    
    return f"{driver}://{user}:{password}@{host}:{port}/{database}"


def create_async_database_url(
    host: str = None,
    port: int = None,
    user: str = None,
    password: str = None,
    database: str = None,
) -> str:
    host = host or settings.db.POSTGRES_HOST
    port = port or settings.db.POSTGRES_PORT
    user = user or settings.db.POSTGRES_USER
    password = password or settings.db.POSTGRES_PASSWORD
    database = database or settings.db.POSTGRES_DB
    
    return f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{database}"


DATABASE_URL = settings.db.DATABASE_URL or create_database_url()
ASYNC_DATABASE_URL = create_async_database_url()


engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=settings.db.DB_POOL_SIZE,
    max_overflow=settings.db.DB_MAX_OVERFLOW,
    pool_timeout=settings.db.DB_POOL_TIMEOUT,
    pool_recycle=settings.db.DB_POOL_RECYCLE,
    pool_pre_ping=settings.db.DB_POOL_PRE_PING,
    echo=settings.db.DB_ECHO,
    echo_pool=settings.db.DB_ECHO_POOL,
    future=True,
    connect_args={
        "connect_timeout": 10,
        "application_name": settings.APP_NAME,
        "options": f"-c statement_timeout={settings.db.DB_STATEMENT_TIMEOUT} -c lock_timeout={settings.db.DB_LOCK_TIMEOUT}",
    },
)


async_engine = create_async_engine(
    ASYNC_DATABASE_URL,
    poolclass=NullPool,
    pool_pre_ping=True,
    echo=settings.db.DB_ECHO,
    future=True,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,
    class_=Session,
)


AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


ScopedSession = scoped_session(SessionLocal)


connection_pool = ConnectionPool(engine.pool)


@event.listens_for(engine, "connect")
def on_connect(dbapi_conn, connection_record):
    db_metrics.increment("total_connections")
    db_metrics.increment("active_connections")
    logger.debug(f"New database connection established: {id(dbapi_conn)}")
    
    cursor = dbapi_conn.cursor()
    cursor.execute("SET timezone = 'America/Chicago'")
    cursor.close()


@event.listens_for(engine, "checkout")
def on_checkout(dbapi_conn, connection_record, connection_proxy):
    db_metrics.increment("active_connections")
    db_metrics.increment("idle_connections", -1)
    logger.debug(f"Connection checked out from pool: {id(dbapi_conn)}")


@event.listens_for(engine, "checkin")
def on_checkin(dbapi_conn, connection_record):
    db_metrics.increment("active_connections", -1)
    db_metrics.increment("idle_connections")
    logger.debug(f"Connection returned to pool: {id(dbapi_conn)}")


@event.listens_for(engine, "invalidate")
def on_invalidate(dbapi_conn, connection_record, exception):
    db_metrics.increment("connection_errors")
    logger.warning(f"Connection invalidated: {exception}")


@event.listens_for(engine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    conn.info.setdefault("query_start_time", []).append(time.time())


@event.listens_for(engine, "after_cursor_execute")
def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    query_times = conn.info.get("query_start_time", [])
    if query_times:
        start_time = query_times.pop()
        elapsed = (time.time() - start_time) * 1000
        db_metrics.record_query_time(elapsed)
        
        if elapsed > 1000:
            logger.warning(f"Slow query ({elapsed:.2f}ms): {statement[:200]}")


@event.listens_for(engine, "handle_error")
def handle_error(context):
    db_metrics.increment("failed_queries")
    logger.error(f"Database error: {context.original_exception}")


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        logger.error(f"Database session error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


async def get_async_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception as e:
            logger.error(f"Async database session error: {e}")
            await session.rollback()
            raise
        finally:
            await session.close()


@contextmanager
def get_db_context() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception as e:
        logger.error(f"Database context error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


@asynccontextmanager
async def get_async_db_context() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception as e:
            logger.error(f"Async database context error: {e}")
            await session.rollback()
            raise
        finally:
            await session.close()


def check_database_connection(max_retries: int = 5, retry_delay: float = 2.0) -> bool:
    for attempt in range(max_retries):
        try:
            with engine.connect() as conn:
                result = conn.execute(text("SELECT 1"))
                result.close()
                
                db_metrics.set("last_health_check", datetime.utcnow().isoformat())
                db_metrics.set("health_check_status", "healthy")
                
                logger.info("Database connection successful")
                return True
                
        except OperationalError as e:
            logger.warning(f"Database connection attempt {attempt + 1}/{max_retries} failed: {e}")
            db_metrics.increment("connection_errors")
            
            if attempt < max_retries - 1:
                time.sleep(retry_delay * (attempt + 1))
        
        except Exception as e:
            logger.error(f"Unexpected database error: {e}")
            db_metrics.increment("connection_errors")
            
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
    
    db_metrics.set("health_check_status", "unhealthy")
    logger.error("Failed to connect to database after all retries")
    return False


async def check_async_database_connection(max_retries: int = 5, retry_delay: float = 2.0) -> bool:
    for attempt in range(max_retries):
        try:
            async with async_engine.connect() as conn:
                result = await conn.execute(text("SELECT 1"))
                result.close()
                
                db_metrics.set("last_health_check", datetime.utcnow().isoformat())
                db_metrics.set("health_check_status", "healthy")
                
                logger.info("Async database connection successful")
                return True
                
        except OperationalError as e:
            logger.warning(f"Async database connection attempt {attempt + 1}/{max_retries} failed: {e}")
            db_metrics.increment("connection_errors")
            
            if attempt < max_retries - 1:
                await asyncio.sleep(retry_delay * (attempt + 1))
        
        except Exception as e:
            logger.error(f"Unexpected async database error: {e}")
            db_metrics.increment("connection_errors")
            
            if attempt < max_retries - 1:
                await asyncio.sleep(retry_delay)
    
    db_metrics.set("health_check_status", "unhealthy")
    logger.error("Failed to connect to async database after all retries")
    return False


def init_db() -> None:
    from app.db.base import Base
    from app.models import user, account, transaction, plaid_item
    from app.models import invoice, category, goal, income_source, cashflow
    from app.models import ai_conversation, automation, chicago, tax
    
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized")


async def init_async_db() -> None:
    from app.db.base import Base
    from app.models import user, account, transaction, plaid_item
    from app.models import invoice, category, goal, income_source, cashflow
    from app.models import ai_conversation, automation, chicago, tax
    
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    logger.info("Async database tables initialized")


def drop_all_tables() -> None:
    from app.db.base import Base
    
    if not settings.is_testing and not settings.DEBUG:
        raise RuntimeError("Cannot drop tables in production")
    
    Base.metadata.drop_all(bind=engine)
    logger.warning("All database tables dropped")


async def drop_all_async_tables() -> None:
    from app.db.base import Base
    
    if not settings.is_testing and not settings.DEBUG:
        raise RuntimeError("Cannot drop tables in production")
    
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    logger.warning("All async database tables dropped")


def get_pool_status() -> Dict[str, Any]:
    return {
        **connection_pool.status(),
        "metrics": db_metrics.get_metrics(),
    }


def dispose_engine() -> None:
    engine.dispose()
    logger.info("Database engine disposed")


async def dispose_async_engine() -> None:
    await async_engine.dispose()
    logger.info("Async database engine disposed")


def with_transaction(func: Callable):
    @wraps(func)
    def wrapper(*args, **kwargs):
        with get_db_context() as db:
            kwargs["db"] = db
            return func(*args, **kwargs)
    return wrapper


def with_async_transaction(func: Callable):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        async with get_async_db_context() as db:
            kwargs["db"] = db
            return await func(*args, **kwargs)
    return wrapper


class DatabaseHealthCheck:
    def __init__(self):
        self._last_check = None
        self._status = "unknown"
        self._details = {}
    
    def check(self) -> Dict[str, Any]:
        try:
            start = time.time()
            is_healthy = check_database_connection(max_retries=1)
            latency = (time.time() - start) * 1000
            
            self._last_check = datetime.utcnow()
            self._status = "healthy" if is_healthy else "unhealthy"
            self._details = {
                "latency_ms": latency,
                "pool_status": connection_pool.status(),
                "metrics": db_metrics.get_metrics(),
            }
            
            return {
                "status": self._status,
                "last_check": self._last_check.isoformat(),
                "details": self._details,
            }
            
        except Exception as e:
            self._status = "error"
            self._details = {"error": str(e)}
            
            return {
                "status": self._status,
                "error": str(e),
            }
    
    async def async_check(self) -> Dict[str, Any]:
        try:
            start = time.time()
            is_healthy = await check_async_database_connection(max_retries=1)
            latency = (time.time() - start) * 1000
            
            self._last_check = datetime.utcnow()
            self._status = "healthy" if is_healthy else "unhealthy"
            self._details = {
                "latency_ms": latency,
                "pool_status": connection_pool.status(),
                "metrics": db_metrics.get_metrics(),
            }
            
            return {
                "status": self._status,
                "last_check": self._last_check.isoformat(),
                "details": self._details,
            }
            
        except Exception as e:
            self._status = "error"
            self._details = {"error": str(e)}
            
            return {
                "status": self._status,
                "error": str(e),
            }


db_health = DatabaseHealthCheck()


def execute_raw_sql(sql: str, params: Dict[str, Any] = None) -> Any:
    with engine.connect() as conn:
        result = conn.execute(text(sql), params or {})
        conn.commit()
        return result


async def execute_async_raw_sql(sql: str, params: Dict[str, Any] = None) -> Any:
    async with async_engine.connect() as conn:
        result = await conn.execute(text(sql), params or {})
        await conn.commit()
        return result


def vacuum_analyze(table_name: str = None) -> None:
    with engine.connect() as conn:
        conn.execute(text("COMMIT"))
        if table_name:
            conn.execute(text(f"VACUUM ANALYZE {table_name}"))
        else:
            conn.execute(text("VACUUM ANALYZE"))
        logger.info(f"VACUUM ANALYZE completed for {table_name or 'all tables'}")


def get_table_sizes() -> Dict[str, int]:
    sql = """
    SELECT 
        relname as table_name,
        pg_total_relation_size(relid) as total_size
    FROM pg_catalog.pg_statio_user_tables
    ORDER BY pg_total_relation_size(relid) DESC
    """
    
    with engine.connect() as conn:
        result = conn.execute(text(sql))
        return {row.table_name: row.total_size for row in result}


def get_index_usage() -> Dict[str, Any]:
    sql = """
    SELECT
        schemaname,
        relname as table_name,
        indexrelname as index_name,
        idx_scan as index_scans,
        idx_tup_read as tuples_read,
        idx_tup_fetch as tuples_fetched
    FROM pg_stat_user_indexes
    ORDER BY idx_scan DESC
    """
    
    with engine.connect() as conn:
        result = conn.execute(text(sql))
        return [dict(row._mapping) for row in result]


def get_slow_queries(min_duration_ms: int = 1000, limit: int = 10) -> list:
    sql = """
    SELECT
        query,
        calls,
        total_exec_time as total_time_ms,
        mean_exec_time as avg_time_ms,
        rows
    FROM pg_stat_statements
    WHERE mean_exec_time > :min_duration
    ORDER BY mean_exec_time DESC
    LIMIT :limit
    """
    
    try:
        with engine.connect() as conn:
            result = conn.execute(text(sql), {"min_duration": min_duration_ms, "limit": limit})
            return [dict(row._mapping) for row in result]
    except Exception:
        return []


def get_active_connections() -> int:
    sql = "SELECT count(*) FROM pg_stat_activity WHERE state = 'active'"
    
    with engine.connect() as conn:
        result = conn.execute(text(sql))
        return result.scalar()


def get_database_size() -> int:
    sql = f"SELECT pg_database_size('{settings.db.POSTGRES_DB}')"
    
    with engine.connect() as conn:
        result = conn.execute(text(sql))
        return result.scalar()


def kill_idle_connections(idle_minutes: int = 30) -> int:
    sql = """
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = :database
    AND state = 'idle'
    AND state_change < NOW() - INTERVAL ':minutes minutes'
    AND pid <> pg_backend_pid()
    """
    
    with engine.connect() as conn:
        result = conn.execute(
            text(sql),
            {"database": settings.db.POSTGRES_DB, "minutes": idle_minutes}
        )
        conn.commit()
        killed = result.rowcount
        logger.info(f"Killed {killed} idle connections older than {idle_minutes} minutes")
        return killed
