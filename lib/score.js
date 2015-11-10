exports.getScore = function(data) {
	var tarData = {}
		, scoresRes = []
		, score = 0
		, sugDetail = {};

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

	[].forEach.call(tarData, function(o) {
		score = 0;
		sugDetail = {};
		var log = o.log
			, entries = log.entries

			, pageSize = parseFloat(log.pages[0].size / 1024).toFixed(1) //dom大小
			, preFetch = log.pages[0].preFetch //dns预解析
			, onLoadTime = log.pages[0].pageTimings.onLoad //onload时间
			, whiteScreen = log.entries[0].timings.wait + log.entries[0].timings.receive //白屏时间
			, domready = log.pages[0].pageTimings.onContentLoad //domready时间ms
			, scoresDtl = []
			, checkItmes = {
				redirectNum: 0
				, notgzipNum: 0
				// , onloadTime: true
				// , serverResTime: true
				, cacheNum: 0
				, largeSrcNum: 0
				, topScrsNum: 0
				, notCND: 0
				, failSrcs: 0
			}
			, sourcePannel = {
				redirectArr: [],
				notgzipArr: [],
				notcacheArr: []
			};
			
		// 移除阻止呈现的javascript
		var topsrcmatchs = o.log.pages[0].headContent.match(/\<script/g)
			, onloadTime = o.log.pages[0].pageTimings.onLoad
			, domain = o.log.pages[0].id.replace(/http(s?)\:\/\/(.+)(\.)(cn|com|org|net).*/, "$2$3$4")
			, cdnReg = new RegExp(domain);
		checkItmes.topScrsNum = topsrcmatchs ? topsrcmatchs.length : 0;
		// console.log(JSON.stringify(o));
		[].forEach.call(entries, function(e, index) {
			var clearUrl = e.request.url.replace(/(.+)(\?)(.*)/,"$1")
				, srcUrlDomain = clearUrl.replace(/http(s?)\:\/\/(.+)([^\/])(\/?)/, "$2$3")
				, status = e.response.status + ""
				, cacheVal = getObj(e.response.headers, "name", "Cache-Control");
			// 避免重定向
			if (!!e.response.redirectURL) {
				checkItmes.redirectNum += 1;
				sourcePannel.redirectArr.push(e.response.redirectURL);
				// console.log("redirectNum: " + checkItmes.redirectNum);
			}
			// 启用压缩功能
			if (getObj(e.response.headers, "name", "Content-Encoding") !== "gzip") {
				checkItmes.notgzipNum += 1;
				sourcePannel.notgzipArr.push(e.request.url);
			}
			// 改善服务器响应时间
			// if (index == 0 && e.timings.wait + e.timings.receive > 200) {
			// 	checkItmes.serverResTime = false;
			// }
			// 使用浏览器缓存
			if (cacheVal) {
				if (typeof cacheVal === "string" && !/(max-age=0)|(no-cache)/.test(cacheVal)) {
					checkItmes.cacheNum += 1;
				} else {
					sourcePannel.notcacheArr.push(e.request.url);
				}
			} else if (!cacheVal) {
				sourcePannel.notcacheArr.push(e.request.url);
			}
			// 缩减资源大小 ?获取response body
			// 过大资源
			if (/image|javascript|css/g.test(e.response.content.mimeType)) {
				if (e.response.content.size / 1024 >= 50) {
					checkItmes.largeSrcNum += 1;
				}
			}
			// 使用CDN
			if (domain !== srcUrlDomain && cdnReg.test(clearUrl)) {
				checkItmes.notCND += 1;
			}
			// 请求失败资源
			if (e.response.status != 200 && e.response.status != 304) {
				checkItmes.failSrcs += 1;
			}
			// 优化css发送过程
			// 按优先级排列可见内容
			// 使用异步脚本
		});
		for (var i in checkItmes) {
			var errCount = checkItmes[i]
				, getScore = 0
				, sugTxt = ""
				, itemTxt_1 = ""
				, itemTxt_2 = ""
				, totalScore = 0;

			if (i !== "cacheNum") {
				getScore = (5 - errCount) >= 0 ? (5 - errCount) : 0;
				score += getScore;
				if (i == "redirectNum") {
					itemTxt_1 = "避免重定向：";
				} else if (i == "notgzipNum") {
					itemTxt_1 = "启用GZIP压缩：";
				} else if (i == "largeSrcNum") {
					itemTxt_1 = "避免过大资源：";
				} else if (i == "notCND") {
					itemTxt_1 = "启用CDN加速：";
				} else if (i == "topScrsNum") {
					itemTxt_1 = "避免脚本阻塞页面：";
				} else if (i == "failSrcs") {
					itemTxt_1 = "避免资源加载失败：";
				}
				itemTxt_2 = "[" + checkItmes[i] + "]条不满足，得分[" + getScore + "/5]";
				sugTxt = itemTxt_1 + itemTxt_2;
				totalScore = 5;
			} else {
				getScore = 10 * (errCount / entries.length);
				score += getScore;
				itemTxt_1 = "静态资源启用缓存：";
				itemTxt_2 = "[" + (entries.length - errCount) + "]条不满足，得分[" + parseFloat(getScore).toFixed(1) + "/10]";
				sugTxt = itemTxt_1 + itemTxt_2;
				totalScore = 10;
			}
			scoresDtl.push(sugTxt);
			sugDetail[i] = [];
			sugDetail[i].push(sugTxt, parseFloat(getScore).toFixed(1), totalScore);
		}
		var _score = 0;
		// score 计算
		// dom大小
		if (pageSize > 0 && pageSize <= 100) {
			_score = 5;
		} else if (pageSize > 100 && pageSize <= 200) {
			_score = 3;
		} else if (pageSize > 200 && pageSize <= 300) {
			_score = 1;
		} else if (pageSize > 300) {
			_score = 0;
		}
		score += _score;
		scoresDtl.push("DOM文档大小：" + pageSize + "KB，得分[" + _score + "/5]");
		sugDetail.domsize = [];
		sugDetail.domsize.push("DOM文档大小：" + pageSize + "KB，得分[" + _score + "/5]", _score, 5);

		// dns预解析
		if (preFetch) {
			_score = 5;
		} else if (!preFetch) {
			_score = 0;
		}
		score += _score;
		scoresDtl.push("DNS预解析：" + preFetch + "，得分[" + _score + "/5]");
		sugDetail.dnsfetch = [];
		sugDetail.dnsfetch.push("DNS预解析：" + preFetch + "，得分[" + _score + "/5]", _score, 5);

		// onloadTime
		if (onLoadTime > 0 && onLoadTime <= 2000) {
			_score = 20;
		} else if (onLoadTime > 2000 && onLoadTime <= 3000) {
			_score = 15;
		} else if (onLoadTime > 3000 && onLoadTime <= 4000) {
			_score = 10;
		} else if (onLoadTime > 4000 && onLoadTime <= 5000) {
			_score = 5;
		} else if (onLoadTime > 5000) {
			_score = 0;
		}
		score += _score;
		scoresDtl.push("onLoad时间：" + onLoadTime + "ms，得分[" + _score + "/20]");
		sugDetail.onload = [];
		sugDetail.onload.push("onLoad时间：" + onLoadTime + "ms，得分[" + _score + "/20]", _score, 20);

		// 白屏时间
		if (whiteScreen > 0 && whiteScreen <= 300) {
			_score = 10;
		} else if (whiteScreen > 300 && whiteScreen <= 500) {
			_score = 7;
		} else if (whiteScreen > 500 && whiteScreen <= 700) {
			_score = 4;
		} else if (whiteScreen > 700 && whiteScreen <= 1000) {
			_score = 1;
		} else if (whiteScreen > 1000) {
			_score = 0;
		}
		score += _score;
		scoresDtl.push("白屏时间：" + whiteScreen + "ms，得分[" + _score + "/10]");
		sugDetail.white = [];
		sugDetail.white.push("白屏时间：" + whiteScreen + "ms，得分[" + _score + "/10]", _score, 10);

		// domready
		if (domready > 0 && domready <= 1000) {
			_score = 10;
		} else if (domready > 1000 && domready <= 2000) {
			_score = 5;
		} else if (domready > 2000) {
			_score = 0;
		}
		score += _score;
		scoresDtl.push("domready时间：" + domready + "ms，得分[" + _score + "/10]");
		sugDetail.domready = [];
		sugDetail.domready.push("domready时间：" + domready + "ms，得分[" + _score + "/10]", _score, 10);

		scoresRes.push({
			score: parseFloat(score).toFixed(1),
			topsrcmatchs: topsrcmatchs, // 阻塞脚本数量
			redirect: sourcePannel.redirectArr, // 重定向资源
			notgzip: sourcePannel.notgzipArr, // 未启用gzip资源
			notCache: sourcePannel.notcacheArr, // 未启用缓存资源
			detail: scoresDtl,
			sugDetail: sugDetail
		});
	});
	return scoresRes;
};