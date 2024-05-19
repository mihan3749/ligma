from fastapi import FastAPI, Request, Response
from fastapi.responses import FileResponse, RedirectResponse, JSONResponse
from img import MyImage, ImageStorage
from functools import wraps
import uvicorn
import base64
import json
import requests


if "conf" not in dir():
	conf = json.load(open("./config.json"))

app = FastAPI()
#storage = ImageStorage(
#    conf["storage"]["path"],
#    conf["storage"]["ram_limit"], 
#    conf["storage"]["disk_limit"]
#)
storage = ImageStorage()
accepted_conns = []

def validate_request(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        if 1: # kwargs["request"].client.host in accepted_conns:
            return await func(*args, **kwargs)
        return RedirectResponse("/capcha")

    return wrapper


@app.get("/")
@validate_request
async def redir_to_main_page(request: Request):
    return RedirectResponse("/main");

@app.get("/main")
@validate_request
async def main_page(request: Request):
    return FileResponse(conf["dir"]["path"] + conf["dir"]["frontend"]["path"] +
        conf["dir"]["frontend"]["main_page_file"])

@app.get("/capcha")
async def capcha_page():
    return FileResponse(conf["dir"]["path"] + conf["dir"]["frontend"]["path"] +
        conf["dir"]["frontend"]["capcha_page_file"])

@app.get("/frontend/{file}")
@validate_request
async def send_frontend_file(file:str, request: Request):
    if file not in conf["dir"]["frontend"].values():
        return Response(status_code=404)
    return FileResponse(conf["dir"]["path"] +
        conf["dir"]["frontend"]["path"] + file)

@app.get("/media/{file}")
@validate_request
async def send_frontend_media_file(file:str, request: Request):
    if file not in conf["dir"]["media"].values():
        return Response(status_code=404)
    return FileResponse(conf["dir"]["path"] +
        conf["dir"]["media"]["path"] + file)

@app.post("/service/upload")
@validate_request
async def get_image(request:Request):
    req = await request.json()
    blob = base64.b64decode(req["content"])
    try:
        img = MyImage(blob, req["type"])
    except RuntimeError:
        return Response(
            {"error": "get_image: obser", "status": 400}, 400)
    storage.add(img)
    return {"hash": img.hash()}

@app.delete("/service/delete")
@validate_request
async def delete(hash: str, request: Request):
    ok = storage.rem(hash)
    if not ok:
        return {"status": 404, "error": "No such image"}
    return {"status": 200}

@app.get("/service/color_distr")
@validate_request
async def color_distr(hash: str, request: Request):
    img = storage.get(hash)
    if not img:
        return {"status": 404,
             "error": "No such image"}
    distr = img.color_histogram().tolist()
    return JSONResponse({"status": 200, "content": distr})

@app.get("/service/data")
@validate_request
async def img_data(hash: str, request: Request):
    img = storage.get(hash)
    if (not img):
        return {"error": "No such image", "status": 404}
    res = img.basedata()
    res["status"] = 200
    return res

@app.get("/service/metadata")
@validate_request
async def metadata(hash: str, request: Request):
    img = storage.get(hash)
    if (not img):
        return {"error": "No such image", "status": 404}
    meta = img.metadata()
    return JSONResponse({"status": 200, "meta": meta})

@app.get("/service/improve")
@validate_request
async def improve(hash: str, request: Request):
    img = storage.get(hash)
    if (not img):
        return {"error": "No such image", "status": 404}
    return img.improve_image()

@app.get("/service/compress")
@validate_request
async def compress(hash: str, quality: int, request: Request):
    img = storage.get(hash)
    if (not img):
        return {"error": "No such image", "status": 404}
    res = img.compress(quality)
    res["status"] = 200
    return res

@app.get("/service/text")
@validate_request
async def ocr_text(hash: str, request: Request):
    img = storage.get(hash)
    if (not img):
        return {"error": "No such image", "status": 404}
    return img.recognize_text()

@app.get("/service/objects")
@validate_request
async def find_objects(hash: str, request: Request):
    img = storage.get(hash)
    if (not img):
        return {"error": "No such image", "status": 404}
    return img.recognize_objects()

@app.get("/service/translate")
@validate_request
async def translate(request:Request):
    return Response("Not implemented", 400)

@app.get("/validate/capcha")
async def check_captcha(token: str, request: Request):
    resp = requests.get(
        "https://smartcaptcha.yandexcloud.net/validate",
        {
            "secret": conf["auth"]["yc_server_key"],
            "token": token,
            "ip": request.client.host
        },
        timeout=1
    )
    server_output = resp.content.decode()
    if resp.status_code != 200:
        print(f"Allow access due to an error: code={resp.status_code}; message={server_output}")
        return True
    resp = json.loads(server_output)
    if resp["status"] == "ok":
        accepted_conns.append(request.client.host)
    return {"status": True}

if __name__ == "__main__":
    try:
        uvicorn.run("server:app", reload=True)
    except:
        del storage