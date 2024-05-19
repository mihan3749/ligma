let conf;
let curr_file;
let curr_img_hash;
let curr_img_src;
let curr_img_quality;
let curr_img_objs;
let err_msg;

async function set_config() {
	let resp = await fetch("/frontend/config.json");
	conf = await resp.json();
}

async function send_image(b64, type) {
	let resp = await fetch(conf.eps.post_img, {
		method: "POST",
		headers: {
			'Accept': 'application/json',
			'Content-Type': 'application/json'
		  },
		body: JSON.stringify({
			content: b64,
			type: type
		})});
    return await resp.json();
}

async function delete_image() {
	let args = new URLSearchParams({hash: curr_img_hash}).toString();
	let url = `${conf.eps.del_img}?${args}`;
	await fetch(url, {method: "DELETE"});
}

function show_msg(text) {
	alert(text);
}

function show_err() {
	alert(err_msg);
	err_msg = undefined;
}

function show_dbg_msg(text) {
	if (conf.debug)
		show_msg(text);
}

function enable_button(elem) {
	elem.classList.remove('disabled');
}

function disable_button(elem) {
	elem.classList.add('disabled');
}

function is_button_disabled(elem) {
	return elem.classList.contains("disabled");
}

function show_elem(elem) {
	elem.classList.remove('hiden');
}

function hide_elem(elem) {
	elem.classList.add('hiden');
}

function is_elem_hiden(elem) {
	return elem.classList.contains("hiden");
}

async function get_img_data() {
	let args = new URLSearchParams({hash: curr_img_hash}).toString();
	let url = `${conf.eps.get_data}?${args}`;
	let resp = await fetch(url);
	return await resp.json();
}

function show_img_size(size) {
	if (size < 1024)
		size = size.toFixed(2) + " B"
	else {
		size /= 1024;
		if (size < 1024)
			size = size.toFixed(2) + " KB";
		else {
			size /= 1024;
			size = size.toFixed(2) + " MB";
		}
	}
	data_elem.querySelector(".row-3 span:not(.light)").textContent = size;
}

async function print_img_data() {
	let data = await get_img_data();
	if (data["status"] >= 300) {
		show_dbg_msg(`print_img_data: ${data["error"]}`);
		return;
	}
	data_elem = document.querySelector("#data");
	data_elem.querySelector(".row-1 span:not(.light)").textContent = data.width;
	data_elem.querySelector(".row-2 span:not(.light)").textContent = data.height;
	show_img_size(data.size);
}

async function get_img_color_distr() {
	let args = new URLSearchParams({hash: curr_img_hash}).toString();
	let url = `${conf.eps.get_color_distr}?${args}`;
	let resp = await fetch(url);
	return await resp.json();
}

async function print_img_color_distr() {
	function draw_line(x1, y1, x2, y2, color) {
		ctx.beginPath();
		ctx.strokeStyle = color;
		ctx.moveTo(x1, y1);
		ctx.lineTo(x2, y2);
		ctx.stroke();
	}
	let resp = await get_img_color_distr();
	if (resp["status"] >= 300) {
		show_dbg_msg(`print_img_color_distr: ${resp["error"]}`);
		return;
	}
	let distr = resp.content;
	let canvas = document.querySelector("#hist");
	canvas.width = conf.color_hist.width;
	canvas.height = conf.color_hist.height;
	let ctx = canvas.getContext("2d");
	let h = canvas.height;
	for (let i = 0; i < canvas.width; i++) {
		let r = distr[i];
		let g = distr[i + 256];
		let b = distr[i + 512];

		let rgb = [[0xff0000, r], [0x00ff00, g], [0x0000ff, b]];
		rgb.sort((a, b) => a[1] - b[1]);

		draw_line(i, h - 1, i, (1 - rgb[0][1]) * h,
			"#" + 0xffffff.toString(16).padStart(6, "0"));
		draw_line(i, (1 - rgb[0][1]) * h + 1, i, (1 - rgb[1][1]) * h,
			"#" + (0xffffff - rgb[0][0]).toString(16).padStart(6, "0"));
		draw_line(i, (1 - rgb[1][1]) * h + 1, i, (1 - rgb[2][1]) * h,
			"#" + rgb[2][0].toString(16).padStart(6, "0"));
	}
}

async function get_img_metadata() {
	let args = new URLSearchParams({hash: curr_img_hash}).toString();
	let url = `${conf.eps["get_metadata"]}?${args}`;
	let resp = await fetch(url);
	return await resp.json();
}

function elem_total_height(elem) {
	let styles = window.getComputedStyle(elem);
	let res = 0.0;
	res += parseFloat(styles.getPropertyValue("height").replace("px", ""));
	res += parseFloat(styles.getPropertyValue("margin-top").replace("px", ""));
	res += parseFloat(styles.getPropertyValue("margin-bottom").replace("px", ""));
	res += parseFloat(styles.getPropertyValue("padding-top").replace("px", ""));
	res += parseFloat(styles.getPropertyValue("padding-bottom").replace("px", ""));
	return res;
}

function set_exif_container_height() {
	let container = document.querySelector("#data");
	let container_height =
		parseFloat(window.getComputedStyle(container)
			.getPropertyValue("height").replace("px", ""));
	container_height -= elem_total_height(container.querySelector("h4"))
	container_height -= elem_total_height(container.querySelector(".vertical > div"))
	let exif_container = document.querySelector("#metadata");
	container_height -= elem_total_height(exif_container) -
		parseFloat(window.getComputedStyle(exif_container).
		getPropertyValue("height").replace("px", ""));
	exif_container.style.height = `${container_height}px`;
}

function set_text_container_height() {
	let container = document.querySelector(".col-3 .row-1");
	let container_height =
		parseFloat(window.getComputedStyle(container)
			.getPropertyValue("height").replace("px", ""));
	container_height -= elem_total_height(container.querySelector("h4"))
	let text_container = document.querySelector("#img-text");
	container_height -= elem_total_height(text_container) -
		parseFloat(window.getComputedStyle(text_container).
		getPropertyValue("height").replace("px", ""));
	text_container.style.height = `${container_height}px`;
}

function set_img_src(elem, value) {
	elem.setAttribute("src", value);
}

window.addEventListener("resize", function(e) {
	set_exif_container_height();
	set_text_container_height();
	place_main_img_canvas();
});

async function print_img_metadata() {
	let metadata = (await get_img_metadata()).meta;
	let exif_container = document.querySelector("#metadata");
	exif_container.innerHTML = '';
	set_exif_container_height();
	for (let key in metadata) {
		let p = document.createElement("p");
		let span_k = document.createElement("span");
		span_k.classList.add("key");
		span_k.textContent = `${key}: `;
		let span_v = document.createElement("span");
		span_v.classList.add("val");
		span_v.textContent = metadata[key];
		p.appendChild(span_k);
		p.appendChild(span_v);
		exif_container.appendChild(p);
	}
	if (Object.keys(metadata).length == 0) {
		let p = document.createElement("p");
		p.textContent = conf.msg.no_exif;
		exif_container.appendChild(p);
	}
}

async function compress_image() {
	let quality = quality_input.value;
	if (quality == curr_img_quality)
		return;
	if (quality < 0 || quality > 100) {
		show_err(conf.err.invalid_qualiry);
		return;
	}
	let args = new URLSearchParams({
		hash: curr_img_hash, quality: quality}).toString();
	let url = `${conf.eps.compress}?${args}`;
	let resp = await fetch(url);
	resp = await resp.json();
	if (resp.status >= 300) {
		show_dbg_msg(`compress_image: ${resp.error}`);
		return;
	}
	curr_img_quality = quality;
	print_img_data();
	print_img_color_distr();
	let img_elem = document.querySelector("#main-img");
	curr_img_src = `data:image\jpeg;base64,${resp.content}`;
	set_img_src(img_elem, curr_img_src);
	enable_button(document.querySelector("#download"));
}

async function improve_image() {
	let args = new URLSearchParams({hash: curr_img_hash}).toString();
	let url = `${conf.eps.improve}?${args}`;
	let resp = await fetch(url);
	resp = await resp.json();
	if (resp.status == 200) {
		let img_elem = document.querySelector("#main-img");
		curr_img_src = `data:image\jpeg;base64,${resp.content}`;
		set_img_src(img_elem, curr_img_src);
		enable_button(document.querySelector("#download"));
		print_img_data();
		print_img_color_distr();
	} else {
		show_dbg_msg(`improve_image: ${resp.error}`);
	}
}

async function get_image_text() {
	let args = new URLSearchParams({hash: curr_img_hash}).toString();
	let url = `${conf.eps["text"]}?${args}`;
	let resp = await fetch(url);
	return await resp.json();
}

async function print_img_text() {
	hide_elem(document.querySelector("#img-text"));
	let resp = await get_image_text();
	if (resp.status == 200) {
		let p = document.querySelector("#img-text");
		if (resp.text == "")
			p.textContent = conf.msg.no_text;
		else
			p.textContent = resp.text;
	} else {
		show_dbg_msg(`print_img_text: ${resp.error}`);
	}
	show_elem(document.querySelector("#img-text"));
	set_text_container_height();
}

function get_rendered_size(contains, cWidth, cHeight, width, height, pos){
	var oRatio = width / height,
		cRatio = cWidth / cHeight;
	return function() {
	  	if (contains ? (oRatio > cRatio) : (oRatio < cRatio)) {
			this.width = cWidth;
			this.height = cWidth / oRatio;
	  	} else {
			this.width = cHeight * oRatio;
			this.height = cHeight;
	  	}
		this.top = (cHeight - this.height)*(pos[1]/100);
		this.bottom = this.height + this.top;
		this.left = (cWidth - this.width)*(pos[0]/100);
		this.right = this.width + this.left;
		return this;
	}.call({});
}
  
function get_img_size_info(img) {
	var pos = window.getComputedStyle(img).getPropertyValue('object-position')
		.replace("%", "").replace("%", "").split(' ');
	return get_rendered_size(true,
		img.width,
		img.height,
		img.naturalWidth,
		img.naturalHeight,
		pos);
}

function place_main_img_canvas() {
	let img = document.querySelector("#main-img");
	let canvas = document.querySelector("#over-main");
	let position = get_img_size_info(img);
	canvas.style.top = position.top + "px";
	canvas.style.left = position.left + "px";
	canvas.style.width = position.width + "px";
	canvas.style.height = position.height + "px";
}

function clear_obj_bounds() {
	let canvas = document.querySelector("#over-main");
	let ctx = canvas.getContext('2d');
	ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function draw_obj_bounds(objs) {
	let img = document.querySelector("#main-img");
	let canvas = document.querySelector("#over-main");
	place_main_img_canvas();
	canvas.width = img.naturalWidth;
	canvas.height = img.naturalHeight;
	let ctx = canvas.getContext('2d');
	ctx.font = `${canvas.height / 20}px Comfortaa`;
	ctx.lineWidth = canvas.height / 200;
	ctx.fillStyle = "#0077ff";
	for (let i in objs) {
		let obj = objs[i];
		let coord = obj[0];
		let label = obj[1];
		ctx.strokeStyle = "#0077ff";
		ctx.strokeRect(
			coord[0], coord[1],
			coord[2] - coord[0], coord[3] - coord[1]);
		ctx.strokeStyle = "white";
		ctx.strokeText(label, coord[0] + 5, coord[3] - 5);
		ctx.fillText(label, coord[0] + 5, coord[3] - 5);
	}
}

async function get_image_objects() {
	let args = new URLSearchParams({hash: curr_img_hash}).toString();
	let url = `${conf.eps.objs}?${args}`;
	let resp = await fetch(url);
	return await resp.json();
}

async function print_img_objects() {
	let resp = await get_image_objects();
	if (resp.status == 200) {
		curr_img_objs = resp.objs;
		draw_obj_bounds(curr_img_objs);
	} else {
		show_dbg_msg(`print_img_objs: ${resp.error}`);
	}
}

async function handle_img_upload(b64) {
	if (curr_img_hash)
		delete_image();
	hide_elem(document.querySelector("#data div"));
	clear_obj_bounds();
	disable_button(document.querySelector("#download"));
	disable_button(document.querySelector("#translate"));
	main_img = document.querySelector("#main-img");
	main_img.src = curr_img_src;
	resp = await send_image(b64, curr_file.type.split("/").pop());
	if (resp.status >= 300) {
		show_dbg_msg(`handle_img_upload: ${resp.error}`);
		return;
	}
	curr_img_hash = resp.hash;
	curr_img_quality = 100;
	
	print_img_data();
	print_img_color_distr();
	print_img_metadata();
	print_img_text();
	print_img_objects();
	show_elem(document.querySelector("#data div"));

	enable_button(document.querySelector("#improve"));
	set_img_src(document.querySelector("#improve img"),
		conf.media.magic_stick_icon);
	enable_button(document.querySelector("#compress"));
}

function encode_img_as_b64(file, callback) {
	let reader = new FileReader();
	reader.onloadend = function(e) {
		let res = e.target.result;
		callback(res.substring(res.indexOf(",") + 1, res.length));
	}
	reader.readAsDataURL(file);
}

function is_img_invalid(file) {
	if (!/image\/*/.test(file.type)) {
		err_msg = conf.err.not_img;
		return;
	}

	if (!(conf.lim.supported_formats.indexOf(
			file.type.split("/").pop()) !== -1)) {
		err_msg = conf.err.unsupported_format;
		return;
	}

	if (file.size > conf.lim.max_file_size) {
		err_msg = conferr.big_file;
		return;
	}

	let img = new Image();
  	img.src = URL.createObjectURL(file);
	img.onload = async function(e) {
		let resolution = img.naturalWidth * img.naturalHeight;
		if (resolution > conf.lim.max_img_resolution) {
			err_msg = conf.err.big_image;
			show_err();
			return;
		}
		curr_img_src = img.src;
		encode_img_as_b64(file, handle_img_upload);
	}
}

let upload_button = document.querySelector("#upload");
upload_button.onclick = async function(e) {
	upload_input.click();
}

upload_button.addEventListener("mouseover", function(e) {
	upload_button.classList.remove('blinking');
});

let upload_input = document.querySelector("#upload + input");
upload_input.onchange = async function(e) {
	curr_file = upload_input.files[0];
	if (!curr_file)
		return;
	is_img_invalid(curr_file);
	if (err_msg) {
		show_err();
		return;
	}
}

let improve_img_button = document.querySelector("#improve");
improve_img_button.onclick = async function(e) {
	if (is_button_disabled(improve_img_button) ||
		improve_img_button.firstElementChild.classList.contains("rotating"))
		return;
	if (compress_button.getAttribute("state") == "text") {
		let icon = improve_img_button.firstElementChild;
		set_img_src(icon, conf.media.loading_icon);
		icon.classList.add("rotating");
		await improve_image();
		icon.classList.remove("rotating");
		set_img_src(icon, conf.media.magic_stick_icon);
		return;
	}
	let icon = improve_img_button.firstElementChild;
	set_img_src(icon, conf.media.loading_icon);
	icon.classList.add("rotating");
	await compress_image();
	icon.classList.remove("rotating");
	let parag = compress_button.querySelector("p");
	let input = compress_button.querySelector("div");
	hide_elem(input);
	show_elem(parag);
	compress_button.setAttribute("state", "text");
	set_img_src(icon, conf.media.magic_stick_icon);
}

let compress_button = document.querySelector("#compress");
compress_button.onclick = function(e) {
	if (is_button_disabled(compress_button))
		return;
	if (compress_button.getAttribute("state") == "input")
		return;
	let parag = compress_button.querySelector("p");
	let input = compress_button.querySelector("div");
	hide_elem(parag);
	show_elem(input);
	compress_button.setAttribute("state", "input");
	set_img_src(improve_img_button.firstElementChild,
		conf.media.tick_icon);
}

let quality_input = document.querySelector("#compress input");
quality_input.oninput = function(e) {
	if (+quality_input.value > +curr_img_quality)
		quality_input.value = curr_img_quality;
	let span = quality_input.previousElementSibling;
	span.textContent = `${quality_input.value}%`;
}

let download_button = document.querySelector("#download");
download_button.onclick = async function(e) {
	try {
		const fileHandle = await window.showSaveFilePicker({
			suggestedName: "file.jpg",
			types: [
				{
					description: 'Изображение',
					accept: {
						'image/jpeg': ['.jpg'],
					},
				},
			],
		});
		const writable = await fileHandle.createWritable();
		let data = await (await fetch(curr_img_src)).blob();

		await writable.write(data);
		await writable.close();
	} catch (err) {
		show_dbg_msg(err);
	}
}

document.body.onclick = function(e) {
	if (e.target !== improve_img_button &&
		!improve_img_button.contains(e.target) &&
		e.target !== compress_button &&
		!compress_button.contains(e.target)) {
		if (compress_button.getAttribute("state") == "text")
			return;
		let parag = compress_button.querySelector("p");
		let input = compress_button.querySelector("div");
		hide_elem(input);
		show_elem(parag);
		compress_button.setAttribute("state", "text");
		set_img_src(improve_img_button.firstElementChild,
			conf.media.magic_stick_icon);
	}
}

window.onbeforeunload = function (e) {
	if (curr_img_hash)
		delete_image();
}

async function init() {
	set_config();
}

init();