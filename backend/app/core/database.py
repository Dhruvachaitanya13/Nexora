from typing import AsyncGenerator, Optional
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.core.config import settings

# Engine and session factory are None at module level - only created when accessed
_engine: Optional[any] = None
_session_factory: Optional[any] = None

def get_engine():
    """Lazily create the async engine."""
    global _engine
    if _engine is None:
        _engine = create_async_engine(settings.db.ASYNC_DATABASE_URL, echo=settings.DEBUG)
    return _engine

def get_session_factory():
    """Lazily create the session factory."""
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(bind=get_engine(), class_=AsyncSession, expire_on_commit=False)
    return _session_factory

AsyncSessionLocal = get_session_factory


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Get database session."""
    async with get_session_factory()() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """Initialize database tables."""
    from app.models.base import Base
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
