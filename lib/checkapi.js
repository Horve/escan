exports.analysis = function(data) {
	var scores = require('./score').getScore(data);
	// 根据键值获取对象
	var getObj = function(objArr, key, value) {
		var reso = {};
		[].forEach.call(objArr, function(o) {
			if (o[key] === value) {
				reso = o;
			}
		});

		return reso.value || {};
	};

	var tarData = {}
		, resData = [];

	if (typeof data === 'object' 
		&& Object.prototype.toString.call(data) === '[object Array]'
	) {
		tarData = data;
	} else if (typeof data === 'object' 
		&& Object.prototype.toString.call(data) === '[object Object]'
	) {
		tarData = [data];
	} else {
		return false;
	}

	[].forEach.call(tarData, function(o, index) {
		var log = o["log"]
			, failSrc = []
			, notCdn = []
			, largeSrc = []
			, _obj
			, srcs = log.entries
			, domain = o.log.pages[0].id.replace(/http(s?)\:\/\/(.+)(\.)(cn|com|org|net).*/, "$2$3$4");
		[].forEach.call(srcs, function(src) {
			if (!/text\/html/g.test(src.response.content.mimeType)) {
				var cdnReg = new RegExp(domain);
				var clearUrl = src.request.url.replace(/(.+)(\?)(.*)/,"$1");
				// 请求失败资源
				if (src.response.status != 200 && src.response.status != 304) {
					failSrc.push(clearUrl);
				}
				// 非cdn资源
				// console.log(cdnReg.test(src.request.url), cdnReg, src.request.url);
				if (cdnReg.test(clearUrl)) {
					notCdn.push(clearUrl);
				}
				// 过大资源
				if (src.response.content.size / 1024 >= 50) {
					largeSrc.push(clearUrl);
				}
			}
		});
		_obj = {
			"url": log.pages[0].id,
			"checkDate": new Date(log.entries[0].startedDateTime).getTime(),
			"score": scores[index].score,
			"baseInfo": {
				"firstScreen": {
					"time": -1,
					"size": -1,
					"requestNum": -1
				},
				"srcsNum": log.entries.length - 1,
				"firstLoad": log.pages[0].pageTimings.onLoad, //首次加载时间ms
				"secondLoad": -1, //二次加载时间ms
				"failedSrcs": failSrc, //请求失败的资源
				"largeSrcs": largeSrc, //超过50kb的资源
				"notCdn": notCdn, //没有使用cnd的资源
				"onLoadTime": log.pages[0].pageTimings.onLoad, //onload时间ms
				"whiteScreen": log.entries[0].timings.wait + log.entries[0].timings.receive, //白屏时间ms
				"domready": log.pages[0].pageTimings.onContentLoad, //domready时间ms
				"size": parseFloat(log.pages[0].size / 1024).toFixed(2) + "KB",
				"preFetch": log.pages[0].preFetch.toString(),

				"topsrcmatchs": scores[index].topsrcmatchs ? scores[index].topsrcmatchs.length : 0, // 阻塞脚本
				"redirect": scores[index].redirect, // 重定向资源
				"notgzip": scores[index].notgzip, // 未启用gzip资源
				"notCache": scores[index].notCache // 未启用缓存脚本
			},
			"scoreDtl": scores[index].detail,
			"sugDetail": scores[index].sugDetail,
			"scrShots": log.scrShots,
			"har": ""
		};
		resData.push(_obj);
	});
	// console.log(JSON.stringify(resData));
	return resData;
}