from fastapi import APIRouter, Response
from fastapi.responses import JSONResponse

router = APIRouter()


@router.get("/health")
def get_health() -> JSONResponse:
    return JSONResponse(content={"status": "healthy"})


@router.get("/")
def get_root() -> Response:
    return Response(content="Project Stargate API")
