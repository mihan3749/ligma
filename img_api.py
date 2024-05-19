import requests as r
import json
from myutils import dprint
from io import BytesIO
from requests_toolbelt.multipart.encoder import MultipartEncoder

def _to_buf(data):
	buf = BytesIO()
	buf.write(data)
	buf.seek(0)
	return buf

def _request_mcs_access_token():
	resp = r.post(conf["eps"]["mcs_oauth"],
		headers={"Content-Type": "application/json"},
		json={
			"client_id": conf["auth"]["mcs_oauth_client_id"],
			"client_secret": conf["auth"]["mcs_oauth_secret_key"],
			"grant_type":"client_credentials"
	})
	data = resp.json()
	if not resp.ok:
		dprint("Failed to request MCS access token.",
		 	data["error"], ":", data["message"])
	conf["auth"]["mcs_access_token"] = data["access_token"]
	conf["auth"]["mcs_refresh_token"] = data["refresh_token"]
	json.dump(conf, open("./config.json", "w"), indent=4)

def _refresh_mcs_access_token():
	resp = r.post(conf["eps"]["mcs_oauth"],
		headers={"Content-Type": "application/json"},
		json={
			"client_id": conf["auth"]["mcs_oauth_client_id"],
			"refresh_token": conf["auth"]["mcs_refresh_token"],
			"grant_type":"refresh_token"
	})
	data = resp.json()
	if not resp.ok:
		dprint("Failed to refresh MCS access token.",
		 	data["error"], ":", data["message"])
	conf["auth"]["mcs_access_token"] = data["access_token"]
	conf["auth"]["mcs_refresh_token"] = data["refresh_token"]
	json.dump(conf, open("./config.json", "w"), indent=4)

def mcs_base_request(data, type, endpoint, meta, handler, recursion_depth=0):
	files = {
		"file": ("file." + type , _to_buf(data), "image/" + type),
		"meta": json.dumps(meta)
	}
	mp_encoder = MultipartEncoder(fields=files)
	params = {
		"oauth_token": conf["auth"]["mcs_access_token"],
		"oauth_provider": conf["auth"]["mcs_provider_name"]
	}
	headers={
		"Content-Type": mp_encoder.content_type,
		"accept": "application/json"
	}
	resp = r.post(
		endpoint,
		data=mp_encoder,
		params=params,
		headers=headers
	).json()
	if resp["status"] == 401 and recursion_depth == 0:
		_refresh_mcs_access_token()
		return mcs_base_request(data, type, endpoint,
			meta, handler, recursion_depth+1)
	elif resp["status"] == 200:
		return handler(resp)
	else:
		return {"status": resp["status"], "error": resp["body"]}

def recognize_objects(data, type):
	def handler(resp):
		objs = []
		if "labels" in resp["body"]["multiobject_labels"][0]:
			objs = [[i["coord"], i["rus"]] for i in \
		   		resp["body"]["multiobject_labels"][0]["labels"]]
		return {"status": 200, "objs": objs}
	
	return mcs_base_request(
		data,
		type,
		conf["eps"]["mcs_recognize_objects"],
		{"mode": ["multiobject"], "images": [{"name": "file"}]},
		handler)

def recognize_text(data, type):
	def handler(resp):
		return {
			"status": 200,
			"text": resp["body"]["objects"][0]["text"] if
				"text" in resp["body"]["objects"][0] else ""
		}
	
	return mcs_base_request(
		data,
		type,
		conf["eps"]["mcs_recognize_text"],
		{"images": [{"name": "file"}]},
		handler
	)

def improve_image(data, type):
	def handler(resp):
		res = {"status": 200}
		if ("colorized_improved" in resp["body"]["improve"][0]):
			res["content"] = resp["body"]["improve"][0]["colorized_improved"]
		else:
			res["content"] = resp["body"]["improve"][0]["improved"]
		return res
	
	return mcs_base_request(
		data,
		type,
		conf["eps"]["mcs_photo_improve"],
		{"mode": ["improve"], "images": [{"name": "file"}]},
		handler
	)

def translate_text():
	pass

if "conf" not in dir():
	conf = json.load(open("./config.json"))

if __name__ == "__main__":
	from pprint import pprint
	data = open("/home/ya/screen.png", "rb").read()
	resp = recognize_text(data, "png")
	pprint(resp)