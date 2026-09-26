"""Minimal sample FastAPI service used as a parser test fixture.

Not a real app — just enough real import statements to exercise
ast_parser.analyze_python_file()'s dependency detection.
"""

import redis
import psycopg2
import httpx
from fastapi import FastAPI

app = FastAPI()
cache = redis.Redis(host="redis", port=6379)


@app.get("/charge")
async def charge(order_id: str):
    conn = psycopg2.connect("dbname=orders host=postgres")
    async with httpx.AsyncClient(timeout=3.0) as client:
        response = await client.post("http://payment-api/charge", json={"order_id": order_id})
    return response.json()
