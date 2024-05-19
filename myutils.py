import json

if "conf" not in dir():
	conf = json.load(open("./config.json"))

def dprint(*args, **kwargs):
	if conf["debug"]:
		print(*args, **kwargs)