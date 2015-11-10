var executeCheck
, arrayOfUrls
, system
, fs
, harArrs = []
, checkapi
, dirPath
, urlsPath
, dnsfetchReg;

system = require("system");
fs = require("fs");

checkapi = require("./lib/checkapi");
dirPath = fs.workingDirectory + "log/";
urlsPath = dirPath + "urls.txt";
dnsfetchReg = /(link.*rel\=(\"|\')dns-prefetch(\"|\'))|(meta.*http-equiv=(\"|\')x-dns-prefetch-control(\"|\').*content=(\"|\')on(\"|\'))/;


if (!Date.prototype.toISOString) {
    Date.prototype.toISOString = function () {
        function pad(n) { return n < 10 ? '0' + n : n; }
        function ms(n) { return n < 10 ? '00'+ n : n < 100 ? '0' + n : n }
        return this.getFullYear() + '-' +
            pad(this.getMonth() + 1) + '-' +
            pad(this.getDate()) + 'T' +
            pad(this.getHours()) + ':' +
            pad(this.getMinutes()) + ':' +
            pad(this.getSeconds()) + '.' +
            ms(this.getMilliseconds()) + 'Z';
    }
}
if (!String.prototype.getLength) {
	String.prototype.getLength = function() {
		var This = this;
		function getLen() {
			var len = 0;
			for (var i = 0; i < This.length; i++) {
				if(This.charCodeAt(i) > 255) {
					len += 2;
				} else {
					len += 1;
				}
			}
			return len;
		}
		return getLen();
	}
}

// console.log("begin check time:" + (new Date).toISOString());

// 生成har文件格式的方法
function createHAR(page, address, title, startTime, resources, size, preFetch) {
	var entries = [];

	[].forEach.call(resources, function(resource) {
		var request = resource.request,
			startReply = resource.startReply,
			endReply = resource.endReply;

		if (!request || !startReply || !endReply) {
			return ;
		}

		// har文件格式中不包含data:image
		if (request.url.match(/^data:image\/.*/i)) {
			return ;
		}

		entries.push({
			startedDateTime: request.time.toISOString(),
			time: endReply.time - request.time,
			request: {
				method: request.method,
				url: request.url,
				httpVersion: 'HTTP/1.1',
				cookies: [],
				headers: request.headers,
				queryString: [],
				headersSize: JSON.stringify(request.headers).length,
				bodySize: -1
			},
			response: {
				status: endReply.status,
				statusText: endReply.statusText,
				httpVersion: 'HTTP/1.1',
				cookies: [],
				headers: endReply.headers,
				redirectURL: endReply.redirectURL,
				headersSize: JSON.stringify(endReply.headers).length,
				bodySize: startReply.bodySize,
				content: {
					size: startReply.bodySize - JSON.stringify(endReply.headers).length,
					mimeType: endReply.contentType
				}
			},
			cache: {},
			timings: {
				blocked: 0,
				dns: -1,
				connect: -1,
				send: 0,
				wait: startReply.time - request.time,
				receive: endReply.time - startReply.time,
				ssl: -1
			},
			pageref: address
		});

	});
	
	return {
		log: {
			version: '1.2',
			creator: {
				name: 'shun.zheng',
				version: phantom.version.major + '.' + phantom.version.major +
					'.' + phantom.version.patch
			},
			pages: [{
				startedDateTime: startTime.toISOString(),
				id: address,
				title: title,
				headContent: page.headContent,
				pageTimings: {
					onLoad: page.endTime - page.startTime,
					onContentLoad: new Date(entries[entries.length - 1]
						.startedDateTime)
						.getTime() + 
						new Date(entries[entries.length - 1].time)
						.getTime() - 
						new Date(entries[0].startedDateTime)
						.getTime()
				},
				size: size,
				preFetch: preFetch
			}],
			entries: entries
		}
	}
}

if (system.args.length === 1) {
	arrayOfUrls = fs.read(urlsPath).split(",");
} else {
	arrayOfUrls = Array.prototype.slice.call(system.args);
	arrayOfUrls.shift();
}
// console.log(JSON.stringify(arrayOfUrls));
executeCheck = function(urls, callbackPerUrl, callbackFinal) {
	var next, page, retrieve, urlIndex, webpage;
	urlIndex = 0;
	webpage = require("webpage");
	page = null;
	getFileName = function() {
		return "site_" + urlIndex + '.har';
	};
	next = function(status, url, file) {
		// page.close();
		callbackPerUrl(status, url, file);
		return retrieve();
	};
	retrieve = function() {
		var url, timer, scrShots = {};
		if(urls.length > 0) {
			link = urls.shift();
			var urlname = link.replace(/http(s?)\:\/\/(.+)(\.)(cn|com|org|net).*/, "$2$3$4");
			urlIndex++;
			page = webpage.create();
			page.viewportSize = {
				width: 320,
				height: 640
			};
			page.clipRect = {
				top: 0,
				left: 0,
				width: 320,
				height: 640
			};
			// 删除截图保存目录
			// console.log('rm -rf ' + (dirPath + urlname));
			return (function(page, link) {
				page.address = link;
				page.resources = []; // 接收页面请求的资源

				page.onLoadStarted = function() {
					// 获取页面开始加载时的时间
					page.startTime = new Date();
					// console.log("onload开始加载:" + (new Date()).getTime());
					// var n = 0;
					// scrShots.loading = [];
					// timer = setInterval(function() {
					// 	n += 1;
					// 	if (n <= 60) {
					// 		var getTime = (new Date()).getTime();
					// 		var picLocate = dirPath + urlname + "/" + getTime + ".jpg";
					// 		page.render(picLocate, {format: 'jpg', quality: '100'});
					// 		// scrShots["loading"][getTime] = picLocate;
					// 		scrShots.loading.push({
					// 			time: getTime,
					// 			url: picLocate
					// 		});
					// 	}
					// }, 100);
				};

				page.onLoadFinished = function() {

					// 获取页面加载完成时的时间
					page.endTime = new Date();
					// console.log("onload结束加载:" + (new Date()).getTime());
					var headContent = page.evaluate(function() {
						return document.head.innerHTML;
					});
					page.headContent = headContent;
				};

				page.onResourceRequested = function(req) {
					// 页面加载资源时的回调
					page.resources[req.id] = {
						request: req,
						startReply: null,
						endReply: null
					};
				};

				page.onResourceReceived = function(res) {
					// console.log(JSON.stringify(res));
					// 资源接收完毕时触发的回调
					if (res.stage === 'start') {
						page.resources[res.id].startReply = res;
					}
					if (res.stage === 'end') {
						page.resources[res.id].endReply = res;
					}
				};
				// page.onError = function(msg, trace) {
				// 	phantom.exit();
				// };
				page.open(page.address, function(status) {
					// clearInterval(timer);
					// timer = null;	
					// var getTime = (new Date()).getTime();
					// var picLocate = dirPath + urlname + "/firstScreenEnd.jpg";
					// page.render(picLocate, {format: 'jpg', quality: '100'});
					// scrShots["end"] = {};
					// scrShots["end"]["time"] = getTime;
					// scrShots["end"]["url"] = picLocate;
					
					// console.log(JSON.stringify(scrShots));

					// console.log("page.open时间:" + (new Date()).getTime());
					// 页面大小
					page.size = page.content.toString().getLength();
					// console.log("PageSize:" + page.size);
					// dns预解析
					page.preFetch = dnsfetchReg.test(page.content.toString());
					// console.log("PreFetch:" + page.preFetch);
					// console.log("接收到响应:" + (new Date()).getTime());
					var har, file = getFileName();
					if (status !== 'success') {
						console.log("Page Loaded Error! ERR INDEX: " + urlIndex);
						return next(status, link, file);
					} else {
						
						// 获取页面加载完成的时间
						page.endTime = new Date();
						// 向页面中通过evaluate方法注入脚本，获取页面标题
						page.title = page.evaluate(function() {
							return document.title;
						});

						// 生成har
						har = createHAR(
							page, 
							page.address, 
							page.title, 
							page.startTime, 
							page.resources,
							page.size,
							page.preFetch // 是否做DNS预解析
						);
						har.log.scrShots = scrShots;
						harArrs.push(har);
						// console.log(JSON.stringify(har));
						return next(status, link, file);
					}
				});
			})(page, link);
		} else {
			return callbackFinal(page);
		}
	};
	return retrieve();
};

executeCheck(arrayOfUrls, function(status, url, file) {
	if (status !== 'success') {
		return console.log("页面加载失败: " + url);
	} else {
		return console.log("已成功加载页面: " + url);
	}
}, function() {
	var checkData = checkapi.analysis(harArrs)
		,stars = ""
		,score = 0;
	// console.log("┏  ┓┗  ┛");
	console.log("╓------------------╖");
	console.log("║    检 测 结 果   ║");
	console.log("╙------------------╜");
	[].forEach.call(checkData, function(o) {
		score = o.score;
		if (score >= 0 && score < 20) {
			stars = "☆☆☆☆☆";
		} else if (score >= 20 && score < 40) {
			stars = "★☆☆☆☆";
		} else if (score >= 40 && score < 60) {
			stars = "★★☆☆☆";
		} else if (score >= 60 && score < 80) {
			stars = "★★★☆☆";
		} else if (score >= 80 && score < 95) {
			stars = "★★★★☆";
		} else if (score >= 95) {
			stars = "★★★★★";
		}
		console.log("▶ 页面地址：" + o.url);
		console.log("▶ 检测时间：" + (new Date(o.checkDate)).toISOString());
		console.log("▶ 综合得分：" + o.score);
		console.log("▶ 页面星级：" + stars);
		console.log("╓------------------╖");
		console.log("║    得 分 详 情   ║");
		console.log("╙------------------╜");
		[].forEach.call(o.scoreDtl, function(item) {
			console.log("☃ " + item);
		});
		console.log("===================================");
	});
	phantom.exit();
});
