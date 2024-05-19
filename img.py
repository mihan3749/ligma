import ctypes
import hashlib
import json
import base64
import img_api
from io import BytesIO
from PIL import Image, ExifTags
import numpy as np
from PIL.TiffImagePlugin import IFDRational


if "conf" not in dir():
	conf = json.load(open("./config.json"))

def _to_buf(data):
	buf = BytesIO()
	buf.write(data)
	buf.seek(0)
	return buf

class MyImage:
	def __init__(self, data, format):
		self.encoded = data
		self.decoded = Image.open(_to_buf(data))
		self.file_size = len(data)
		self._hash = hashlib.sha256(data).hexdigest()
		self._text = None
		self.format = format
		
	def _reset(self, data):
		self.encoded = data
		self.decoded = Image.open(_to_buf(data))
		self.file_size = len(data)

	def hash(self):
		return self._hash

	def basedata(self):
		return {
			"width": self.decoded.width,
			"height": self.decoded.height,
			"size": self.file_size
		}

	def metadata(self):
		exif = self.decoded._getexif()
		if not exif:
			return {}
		res = dict()
		for i in exif:
			k = ExifTags.TAGS[i]
			if type(exif[i]) == bytes:
				res[k] = exif[i].decode('utf-8', errors='ignore')
			elif type(exif[i]) == IFDRational:
				res[k] = float(exif[i])
			else:
				res[k] = exif[i]
		return res

	def color_histogram(self):
		img_array = np.array(self.decoded)

		r = np.histogram(img_array[:,:,0].ravel(), bins=256, range=[0, 256])[0]
		r = r / max(r)
		g = np.histogram(img_array[:,:,1].ravel(), bins=256, range=[0, 256])[0]
		g = g / max(g)
		b = np.histogram(img_array[:,:,2].ravel(), bins=256, range=[0, 256])[0]
		b = b / max(b)

		return np.concatenate((r, g, b), axis=0)
	
	def recognize_objects(self):
		return img_api.recognize_objects(self.encoded, self.format)

	def recognize_text(self):
		resp = img_api.recognize_text(self.encoded, self.format)
		if resp["status"] == 200:
			self._text = resp["text"]
		return resp

	def translate_text(self):
		pass

	def improve_image(self):
		resp = img_api.improve_image(self.encoded, self.format)
		if resp["status"] == 200:
			data = base64.b64decode(resp["content"])
			self._reset(data)
		return resp

	def compress(self, quality):
		buf = BytesIO()
		self.decoded.save(buf, format="JPEG", quality=quality)
		buf = buf.getvalue()
		self.format = "jpeg"
		self._reset(buf)
		size = len(buf)
		buf = base64.b64encode(buf)
		return {"content": buf, "size": size}

class ImageStorage:
	def __init__(self):
		self.content = dict()

	def add(self, img):
		hash = img.hash()
		if (hash not in self.content):
			self.content[hash] = img
			return True
		return False

	def get(self, hash):
		try:
			return self.content[hash]
		except:
			return None

	def rem(self, hash):
		try:
			del self.content[hash]
			return True
		except:
			return False