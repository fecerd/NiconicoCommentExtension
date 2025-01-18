//ビデオの描画サイズと左上のY座標を取得する
function GetVideoSize(video) {
	var originW = video.videoWidth;
	var originH = video.videoHeight;
	var originAspect = originH /originW;

	var tagW = video.clientWidth;
	var tagH = video.clientHeight;
	var tagAspect = tagH /tagW;

	var screenW, screenH;
	if (originAspect > tagAspect) {
		screenH = video.clientHeight;
		screenW = screenH / originAspect;
	} else {
		screenW = video.clientWidth;
		screenH = screenW * originAspect;
	}
	return { "width":screenW, "height":screenH, "top": (tagH - screenH) / 2 };
}

//キーフレーム情報を設定
var ChangeKeyFrameInfo = function(style, width, height, top) {
	var t0 = "@keyframes lane";
	var t1 = "{ from { transform: translate(";
	var t2 = "px); } to { transform: translate(";
	var t3 = "px); } }";
	var lineHeight = Number((height / numLane).toFixed());
	var left = width * -2;
	for (var i = 0; i < numLane; ++i) {
		var h = (15 + top + lineHeight * i).toString();
		var text = t0 + i.toString() + t1 + (width * 1.0).toFixed() + "px, " + h + t2 + left + "px, " + h + t3;
		style.sheet.insertRule(text, style.sheet.cssRules.length);
	}

	t0 = "@keyframes center";
	t1 = "{ from { transform: translate(";
	t2 = "px); } to { transform: translate(";
	t3 = "px); } }";
	for (var i = 0; i < numLane; ++i) {
		var h = (15 + top + lineHeight * i).toString();
		var text = t0 + i.toString() + t1 + "-50%, " + h + t2 + "-50%, " + h + t3;
		style.sheet.insertRule(text, style.sheet.cssRules.length);
	}
}

//フォントの大きさを設定
var mediumSize = 30;
function ChangeFontSizeStyle(style, height) {
	mediumSize = Math.ceil(height / (numLane + 1));
	style.sheet.insertRule(".medium { font-size: " + mediumSize + "px; }", 0);
	style.sheet.insertRule(".big { font-size: " + (mediumSize * 1.5) + "px; }", 1);
	style.sheet.insertRule(".small { font-size: " + (mediumSize / 1.5) + "px; }", 2);
	style.sheet.insertRule(".xsmall { font-size: " + (mediumSize / 2.0) + "px; }", 3);
	style.sheet.insertRule(".xxsmall { font-size: " + (mediumSize / 3.0) + "px; }", 4);
}

//API名と引数をバックグラウンドに渡し、結果を待つ
async function SendAPI(name, object) {
	var port = chrome.runtime.connect({ name:"APIChannel" });
	var result = await new Promise((resolve) => {
		port.postMessage({ APIName: name, APIObject: object });
		port.onMessage.addListener(msg => { resolve(msg.result); });
	});
	return result;
}

var offsetSwitch = false;	//末尾が長い動画シリーズのときはtrueにする
var lengthSeconds = 0;	//SearchAPIの戻り値retからret.data[0].lengthSecondsで取り出せる公式チャンネル動画の秒数
var offset = NaN;	//コメントを表示する位置をずらす(ms)
//コメントのズレを修正するOffsetを更新する
//video(HTMLVideoElement): 現在のページのvideo要素
function CalcOffset(video, title){
	var dCurrentSeconds = video.duration;
	if (title) {
		if (title.includes("けいおん！！")) {
			if (title.includes("第1話")) offset = -10 * 1000;
			else offset = -19 * 1000;
			console.log("けいおん！！用オフセット");
			console.log("現在の動画: " + dCurrentSeconds + "秒\n公式動画: " + lengthSeconds + "秒\nオフセット: " + (offset / 1000.0) + "秒");
			return;
		}
	}
	if (dCurrentSeconds == NaN || dCurrentSeconds == Infinity){
		offset = NaN;
	}
	else{
		offset = (dCurrentSeconds - lengthSeconds) * 1000;
	}
	if (offsetSwitch) {
		offset = 0;
	}
	console.log("現在の動画: " + dCurrentSeconds + "秒\n公式動画: " + lengthSeconds + "秒\nオフセット: " + (offset / 1000.0) + "秒");
}

function SwitchOffsetMode(word) {
	var result = -1;
	do {
		result = word.indexOf("マギアレコード");
		if (result == -1) break;
	} while(false);
	//ここに並べる
	offsetSwitch = result != -1;
}

const danimeID = "ch2632720";

async function IsOfficial() {
	//この動画のIDを取得(公式引用確認のため)
	var splits = location.href.split('/');
	var currentID = null;
	for (var i = splits.length; i-- > 0;) {
		if (splits[i].startsWith("so")) {
			currentID = splits[i];
			break;
		}
	}
	if (currentID == null) return Promise.reject(new Error("この動画のIDが取得できませんでした。"));
	//公式引用の確認(スレッドのIDが3種類以上あるとき、引用あり)
	return await SendAPI("GetVideoPageAPI", { "id": currentID })
	.then(text => new DOMParser().parseFromString(text, "text/html"))
	.then(doc => ({ "doc": doc, "el": doc.getElementById("js-initial-watch-data") }))
	.then(obj => ({ "doc": obj.doc, "js": JSON.parse(obj.el.getAttribute("data-api-data")) }))
	.then(obj => {
		//dアニメ動画か確認
		if (obj.js.channel.id != danimeID) {
			console.log("この動画はdアニメ ニコニコ支店のものではありません。");
			return Promise.reject(new Error());
		}
		else return { "doc": obj.doc, "threads": obj.js.comment.threads };
	})
	.then(obj => {
		var ids = new Array();
		for (var i = 0; i < obj.threads.length; ++i) {
			if (!ids.includes(obj.threads[i].id)) ids.push(obj.threads[i].id);
		}
		return { "doc": obj.doc, "length": ids.length };
	})
	.then(obj => {
		if (obj.length > 2) return Promise.reject(new Error("この動画には既に公式動画からの引用コメントが存在します。"));
		else return obj;
	})
	.catch(e => ({ "doc": null, "length": -1 }));
}

class GetInfoForNiconico {
	video = null;
	currentID = null;
	titleName = null;
	threadCount = -1;
	//この動画のIDを取得(公式引用確認のため)
	_FindCurrentID() {
		this.currentID = null;
		var splits = location.href.split('/');
		for (var i = splits.length; i-- > 0;) {
			if (splits[i].startsWith("so")) {
				this.currentID = splits[i];
				break;
			}
		}
	}
	//公式引用の確認(スレッドのIDが3種類以上あるとき、引用あり)
	async _CheckQuote() {
		this.titleName = null;
		this.threadCount = -1;
		const result = await SendAPI("GetVideoPageAPI", { "id": this.currentID })
		.then(text => new DOMParser().parseFromString(text, "text/html"))
		.then(doc => ({ "doc": doc, "el": doc.getElementById("js-initial-watch-data") }))
		.then(obj => ({ "doc": obj.doc, "js": JSON.parse(obj.el.getAttribute("data-api-data")) }))
		.then(obj => {
			//dアニメ動画か確認
			if (obj.js.channel.id != danimeID) {
				console.log("この動画はdアニメ ニコニコ支店のものではありません。");
				return Promise.reject(new Error());
			}
			else return { "doc": obj.doc, "threads": obj.js.comment.threads };
		})
		.then(obj => {
			var ids = new Array();
			for (var i = 0; i < obj.threads.length; ++i) {
				if (!ids.includes(obj.threads[i].id)) ids.push(obj.threads[i].id);
			}
			return { "doc": obj.doc, "length": ids.length };
		})
		.catch(e => ({ "doc": null, "length": -1 }));
		if (result.doc == null) {
			this.threadCount = -1;
			this.titleName = null;
		}
		else {
			this.threadCount = result.length;
			this.titleName = result.doc.title;
		}
		if (this.threadCount < 0) console.log("この動画の情報が取得できませんでした。");
		else if (result.length > 2) {
			console.log("この動画には既に公式動画からの引用コメントが存在します。")
		}
	}
	SetEvent() {
		this._FindCurrentID();
	}
	async AsnycEvent() {
		this._FindCurrentID();
		await this._CheckQuote();
	}
	GetTitleName() { return this.titleName; }
	GetVideoTag() { return this.video; }
}

class GetInfoForAmazon {
	webplayer = null;
	video = null;
	title = null;
	subtitle = null;
	titleName = null;
	loadObserver = null;
	titleObserver = null;
	_GetTitle() {
		if (!this.title || !this.subtitle) {
			if (this.titleObserver) this.titleObserver.disconnect();
			this.titleName = null;
			this.SetEvent();
			return;
		}
		var titleText = this.title.textContent;
		var subtitleText = this.subtitle.textContent;
		subtitleText = subtitleText
			.replace(/シーズン\d?\d*/, ' ')
			.replace('エピソード', ' ')
			.replace('「', '')
			.replace('」', '')
			.replace('、', '');
		this.titleName = titleText + subtitleText;
		if (!this.titleName) {
			this.titleName = null;
			return;
		}
		console.log("_GetTitle: " + this.titleName);
	}
	_Load() {
		if (!this.webplayer) {
			this.webplayer = document.getElementById("dv-web-player");
			if (!this.webplayer) return;
		}
		this.video = this.webplayer.getElementsByTagName("video").item(0);
		if (!this.video) return;
		this.title = this.webplayer.querySelector('[class*="-title-text"]')
		this.subtitle = this.webplayer.querySelector('[class*="-subtitle-text"]');
		if (!this.title || !this.subtitle) return;
		this.loadObserver.disconnect();
		this.loadObserver = null;
	
		this._GetTitle();
		this.titleObserver = new MutationObserver(this._GetTitle.bind(this));
		this.titleObserver.observe(
			this.subtitle,
			{
				childList: true,
				attributes: true,
				characterData: true,
				subtree: true
			}
		);
		console.log("Set _GetTitle Observer.");
	}
	SetEvent() {
		this.webplayer = document.getElementById("dv-web-player");
		if (!this.webplayer) {
			console.log("webplayerがありません。");
			return;
		}
		this.loadObserver = new MutationObserver(this._Load.bind(this));
		this.loadObserver.observe(
			this.webplayer,
			{
				childList: true,
				subtree: true
			}
		);
	}
	async AsnycEvent() {
		var timer = null;
		timer = setInterval(
			(name, timer) => {
				if (name != null) clearInterval(timer);
			}
			, 10, this.titleName, timer
		);
	}
	GetTitleName() { return this.titleName; }
	GetVideoTag() { return this.video; }
}

var gInfo = null;

//コメント取得処理
async function GetComments(comments) {
	//コメント配列を削除
	comments.splice(0);
	//非同期処理を同期実行
	await gInfo.AsnycEvent();
	//動画タイトルから検索キーワードを生成
	var word = buildSearchWord(gInfo.GetTitleName());

	//動画タイトルによってオフセットモードを変更
	SwitchOffsetMode(word);
	console.log("タイトル: " + word + " に一致する一番コメントの多い動画を検索します。");
	//コメントを取得
	const r = await SendAPI("SearchAPI", { "word": word })
	.then(ret => {
		if (ret.data.length == 0) return Promise.reject(new Error("検索結果が存在しませんでした。"));
		console.log("検索結果は以下の動画です。\nタイトル: " + ret.data[0].title + "\nコメント数: " + ret.data[0].commentCounter);
		lengthSeconds = ret.data[0].lengthSeconds;
		if (ret.data[0].channelId != undefined) return ret.data[0].contentId; 
		else return Promise.reject(new Error("検索結果がチャンネル動画ではありませんでした。"));
	})
	.then(id => SendAPI("GetVideoPageAPI", { "id": id }))
	.then(text => new DOMParser().parseFromString(text, "text/html"))
	.then(doc => doc.getElementById("js-initial-watch-data"))
	.then(el => JSON.parse(el.getAttribute("data-api-data")))
	.then(js => js.comment.nvComment)
	.then(nvComment => SendAPI("CommentServerAPI", { "nvComment": nvComment }))
	.then(result => {
		var threads = result.data.threads;
		var index = -1;
		for (var i = 0; i < threads.length; ++i) {
			if (threads[i].commentCount != 0 && threads[i].fork == "main") {
				index = i;
				break;
			}
		}
		if (index < 0) return Promise.reject(new Error("検索した動画にはコメントがありません。"));
		var thread = threads[index];
		for (var i = 0; i < thread.comments.length; ++i) {
			comments.push({ "vposMs": Number(thread.comments[i].vposMs), "data": thread.comments[i].body, "commands": thread.comments[i].commands });
		}
		comments.sort((a, b) => Number.isNaN(a.vposMs) || Number.isNaN(b.vposMs) ? (Number.isNaN(a.vposMs) ? (Number.isNaN(b.vposMs) ? 0 : 1) : -1) : a.vposMs - b.vposMs);
		return comments.length + "個のコメントを表示します。";
	})
	.then(result => { return { "status": true, "result": result }; })
	.catch(e => { return { "status": false, "result": "コメント取得に失敗しました。\nメッセージ: " + e.message }; });
	if (r.status) console.log(r.result);
	else return Promise.reject(new Error(r.result));
}

var gComments = new Array();	//取得したコメントが時間順に入る配列{ "vposMs": number, "data": string, "commands": string[] }
var state = false;	//timeupdateイベントを受信したときに、新たなコメントを追加するか否か
var seeking = false;	//seekingイベントが起きてからseekedイベントが起こるまでの間、true
var prev = -1000;	//前回のtimeupdateで処理した最後のコメントインデックスの次のインデックス
const numLane = 15;	//レーンの数
var bLane = new Array();	//レーンの状態{ "using": number, "length": number }

//コメントをスクリーンに追加する
//startOffset(Int): シーク直後の描画で使用されるコメントの範囲。現在時刻からのマイナス時間で設定(ms)
//isUpdate(boolean): timeupdateイベントから呼ばれるとき、true
//video(HTMLVideoElement): 現在時刻を取得するビデオ要素
var update = function (startOffset, isUpdate, video) {
	if (isUpdate && !state) return;	//timeupdateイベント時、stateがfalseなら処理しない
	if (seeking) return;	//シーク中は処理しない
	if (gComments.length == 0) return;	//コメントが取得されていないとき、処理しない
	var screen = document.getElementById("screen");
	if (screen == null) return;
	var time = Number((video.currentTime * 1000).toFixed(3));	//単位ms
	//シーク直後はstartOffsetミリ秒前のコメントから表示する
	if (prev < 0) {
		var startTime = time + startOffset;
		for (var i = 0; i < gComments.length; ++i) {
			if (Number(gComments[i].vposMs) > startTime) {
				prev = i;
				break;
			}
		}
		if (prev < 0) return;
	}
	var endTime = time + 150;	//次のtimeupdateまで時間があるため現時刻よりも多めに流す
	if (gComments[prev] == null) return;
	//オフセットを取得
	if (isNaN(offset)) CalcOffset(video, gInfo.titleName);
	const _offset = Number(isNaN(offset) ? -2000 : offset);
	for (var i = prev; i < gComments.length; ++i) {
		var vpos = Number(gComments[i].vposMs);
		var pos = vpos + _offset;
		if (pos < 0) continue;
		else if (pos <= endTime) {
			//spanタグを生成する
			var el = document.createElement("span");
			var text = document.createTextNode(gComments[i].data);
			el.appendChild(text);
			el.style.color = "white";
			var classes = new Array();	//spanタグの持つcomment以外のクラス
			classes.push("comment");
			//コマンド処理
			var BigSmall = 0;
			var isDefont = true;
			var UeShita = 0;
			if (gComments[i].commands.length != 0) {
				var commands = gComments[i].commands;
				for (var j = 0; j < commands.length; ++j) {
					switch (commands[j]) {
						case "red":
						case "pink":
						case "orange":
						case "yellow":
						case "green":
						case "cyan":
						case "blue":
						case "purple":
						case "black":
							el.style.color = commands[j];
							break;
						case "big":
							BigSmall = 1;
							break;
						case "small":
							BigSmall = -1;
							break;
						case "gothic":
						case "mincho":
							isDefont = false;
							classes.push(commands[j]);
							break;
						case "ue":
							UeShita = 1;
							break;
						case "shita":
							UeShita = -1;
							break;
					}
				}
			}
			//レーンID
			var tmpId = Math.floor(Math.random() * numLane);	//[0, numLane - 1]の整数
			var id = tmpId;
			//どのレーンに流すか決める
			if (UeShita == 0) {
				for (; id < numLane; ++id) if (bLane[id].using <= 0) break;	//使われていないレーンを探す(1)
				if (id == numLane) {
					id = 0;
					for (; id < tmpId; ++id) if (bLane[id].using <= 0) break;	//使われていないレーンを探す(2)
					//すべてのレーンが使われている場合、末尾が一番左側にあるレーンを使用する
					if (id == tmpId) {
						var len = Infinity;
						for (var j = 0; j < numLane; ++j) {
							if (Number(bLane[j].length) < len) {
								len = Number(bLane[j].length);
								id = j;
							}
						}
					}
				}
				el.id = "lane" + id.toString();
			}
			else {
				if (UeShita > 0) {
					id = 0;
					for (; id < numLane; ++id) if (bLane[id].length != Infinity) break;
					if (id == numLane) {
						id = 0;
						var using = Infinity;
						for (var j = 0; j < numLane; ++j) {
							if (bLane[j].using < using) {
								using = bLane[j].using;
								id = j;
							}
						}
					}
				} else {
					id = numLane;
					for (; id-- > 0;) if (bLane[id].length != Infinity) break;
					if (id < 0) {
						id = numLane - 1;
						var using = Infinity;
						for (var j = numLane; j-- > 0;) {
							if (bLane[j].using < using) {
								using = bLane[j].using;
								id = j;
							}
						}
					}
				}
				el.id = "center" + id.toString();
			}
			//クラスを設定
			if (UeShita == 0) {
				if (BigSmall == 0) classes.push("medium");
				else classes.push(BigSmall > 0 ? "big" : "small");
			}
			else {
				var size = GetVideoSize(video);
				var w = gComments[i].data.length * mediumSize;
				if (BigSmall > 0 && (w * 1.5 < size.width)) classes.push("big");
				else if (w < size.width) classes.push("medium");
				else if (w / 1.5 < size.width) classes.push("small");
				else if (w / 2.0 < size.width) classes.push("xsmall");
				else classes.push("xxsmall");
			}
			if (isDefont) classes.push("defont");
			el.classList.add(...classes);
			++bLane[id].using;
			//一文字を(5000 / 30)msに換算してレーン末尾の位置とする
			var len = UeShita == 0 ? pos +	Math.floor(gComments[i].data.length * (5000.0 / 30)) : Infinity;
			if (Number(bLane[id].length) < len) bLane[id].length = len;
			var delaySec = (pos - time) / 1000;	//現在の再生時間から見たコメント時間の位置(s)
			if (UeShita == 0) {
				if (isUpdate) el.style.animationDuration = (10 + delaySec).toString() + "s";	//再生中はコメントスピードを変化させる
				else el.style.animationDelay = delaySec.toString() + "s";	//シーク後は表示位置を前後させる
			}
			//アニメーションが終わった時点で自身を削除する
			el.addEventListener(
				"animationend",
				entries => {
					var idname = entries.target.id;
					var id = numLane;
					if (idname.startsWith("lane")) id = Number(idname.substring(4));
					else if (idname.startsWith("center")) {
						id = Number(idname.substring(6));
						if (id < numLane) bLane[id].length = -1;
					}
					if (id < numLane) --bLane[id].using;
					screen.removeChild(entries.target);
				},
				false
			);
			screen.appendChild(el);
		}
		else {
			prev = i;
			break;
		}
	}
};

//コメントのアニメーションの再生・停止を決めるスタイル(HTMLStyleElement)
var animationStyle = null;
function main() {
	GetComments(gComments)
	.then(() => {
		//レーンの状態を初期化
		for (var i = 0; i < numLane; ++i) bLane.push({ "using": 0, "length": 0 });
		//ビデオ要素の取得
		var videos = document.getElementsByTagName("video");
		if (videos.length == 0) {
			console.error("video要素が存在しません。");
			return;
		}
		//オフセットをリセット
		offset = NaN;
		var video = videos[0];
		//ID:screenのスタイルを設定
		var screenStyle = document.createElement("style");
		document.head.appendChild(screenStyle);
		screenStyle.sheet.insertRule("#screen{ background-color: #000; width: 100%; height: 100%; overflow: hidden; white-space: nowrap; cursor:default; -ms-user-select: none; -moz-user-select: none; -webkit-user-select: none; user-select: none; position: relative; }", 0);
		//ID:lane0からlane numLaneのスタイルを設定
		var animeLaneStyle = document.createElement("style");
		document.head.appendChild(animeLaneStyle);
		for (var i = 0; i < numLane; ++i) {
			var n = i.toString();
			var text = "#lane" + n + "{ animation-name: lane" + n + "; animation-timing-function: linear; animation-duration: 10s; animation-fill-mode: forwards; }";
			animeLaneStyle.sheet.insertRule(text, i);
			var text = "#center" + n + "{ animation-name: center" + n + "; animation-timing-function: linear; animation-duration: 3s; animation-fill-mode: forwards; }";
			animeLaneStyle.sheet.insertRule(text, i);
		}
		//Class:commentのスタイルを設定
		var commentStyle = document.createElement("style");
		document.head.appendChild(commentStyle);
		for (var i = 0; i < numLane; ++i) commentStyle.sheet.insertRule("#center" + i.toString() + "{ left: 50%; }");
		commentStyle.sheet.insertRule(".comment{ position: absolute; letter-spacing: 1px; padding: 2px 0 2px; white-space: nowrap; z-index: 2; }", 0);
		commentStyle.sheet.insertRule(".comment{ opacity: 0.5; font-weight: 600; line-height: 29px; text-shadow: black 1px 0px, black -1px 0px, black 0px -1px, black 0px 1px, black 1px 1px , black -1px 1px, black 1px -1px, black -1px -1px, black 0px 1px, black -0px 1px, black 0px -1px, black -0px -1px, black 1px 0px, black -1px 0px, black 1px -0px, black -1px -0px; }", 1);
		//Class:commentのアニメーション状態を設定
		animationStyle = document.createElement("style");
		document.head.appendChild(animationStyle);
		animationStyle.sheet.insertRule(".comment{ animation-play-state: running }", 0);
		//フォントファミリーのスタイルを設定
		var fontNameStyle = document.createElement("style");
		document.head.appendChild(fontNameStyle);
		var defont = "'Arial', sans-serif";
		var gothic = '"Hiragino Sans W3", "Hiragino Kaku Gothic ProN", "ヒラギノ角ゴ ProN W3", "メイリオ", Meiryo, "ＭＳ Ｐゴシック", "MS PGothic", sans-serif';
		var mincho = '"游明朝", YuMincho, "Hiragino Mincho ProN W3", "ヒラギノ明朝 ProN W3", "Hiragino Mincho ProN", "HG明朝E", "ＭＳ Ｐ明朝", "ＭＳ 明朝", serif';
		fontNameStyle.sheet.insertRule(".defont { font-family: " + defont + "; }", 0);
		fontNameStyle.sheet.insertRule(".gothic { font-family: " + gothic + "; }", 1);
		fontNameStyle.sheet.insertRule(".mincho { font-family: " + mincho + "; }", 2);
		//videoのサイズ
		var size = GetVideoSize(video);
		//キーフレームのスタイルを設定
		var keyframeStyle = document.createElement("style");
		document.head.appendChild(keyframeStyle);
		ChangeKeyFrameInfo(keyframeStyle, size.width, size.height, size.top);
		//フォントサイズのスタイルを設定
		var fontSizeStyle = document.createElement("style");
		document.head.appendChild(fontSizeStyle);
		ChangeFontSizeStyle(fontSizeStyle, size.height);

		//スクリーンの追加
		var parent = video.parentElement;
		var screen = document.createElement("div");
		screen.id = "screen";
		parent.appendChild(screen);
		screen.appendChild(video);
		//動画が停止したとき、コメントを止める
		video.addEventListener(
			"pause",
			function(){
				state = false;
				animationStyle.sheet.deleteRule(0);
				animationStyle.sheet.insertRule(".comment{ animation-play-state: paused }", 0);
			},
			false
		);
		//動画の再生が始まったとき、コメントを流し始める
		video.addEventListener(
			"play",
			function(){
				state = true;
				animationStyle.sheet.deleteRule(0);
				animationStyle.sheet.insertRule(".comment{ animation-play-state: running }", 0);
			},
			false
		);
		//動画の再生が終わったとき、最後までコメントを流しきる
		video.addEventListener(
			"ended",
			function () {
				state = false;
				animationStyle.sheet.deleteRule(0);
				animationStyle.sheet.insertRule(".comment{ animation-play-state: running }", 0);
			},
			false
		);
		//シーク操作が開始したとき、コメントを削除する
		video.addEventListener(
			"seeking",
			function () {
				seeking = true;
				prev = -1000;
				for (var i = 0; i < bLane.length; ++i) bLane[i] = { "using": 0, "length": 0 };
				var comments = document.querySelectorAll(".comment");
				for (var i = comments.length; i-- > 0;) comments[i].remove();
			},
			false
		);
		//シーク操作が終わったとき、コメントを描画する
		video.addEventListener(
			"seeked",
			() => { seeking = false; update(-5000, false, video); },
			false
		);
		//再生中に呼ばれるイベント
		video.addEventListener(
			"timeupdate",
			() => {
				if (state == video.paused) {
					state = !video.paused;
					animationStyle.sheet.deleteRule(0);
					animationStyle.sheet.insertRule(".comment{ animation-play-state: " + (state ? "running" : "paused") + " }", 0);
				}
				update(-2000, true, video); 
			},
			false
		);
		//「続きから再生」されるとき、ページ読み込み後にコメント描画
		if (video.currentTime != 0) {
			prev = -1000;
			var comments = document.querySelectorAll(".comment");
			for (var i = comments.length; i-- > 0;) comments[i].remove();
			animationStyle.sheet.deleteRule(0);
			animationStyle.sheet.insertRule(".comment{ animation-play-state: " + (state ? "running" : "paused") + " }", 0);
			update(-5000, false, video);
		}
		//リサイズ時、コメントサイズとアニメーションの範囲を変更する
		const observer = new ResizeObserver(
			function(entries){
				var size = GetVideoSize(video);
				//キーフレームのスタイルをすべて更新
				while (keyframeStyle.sheet.cssRules.length != 0) keyframeStyle.sheet.deleteRule(keyframeStyle.sheet.cssRules.length - 1);
				ChangeKeyFrameInfo(keyframeStyle, size.width, size.height, size.top);
				//フォントサイズ(Class:medium, big, small)のスタイルをすべて更新
				while (fontSizeStyle.sheet.cssRules.length != 0) fontSizeStyle.sheet.deleteRule(fontSizeStyle.sheet.cssRules.length - 1);
				ChangeFontSizeStyle(fontSizeStyle, size.height);
			});
		observer.observe(parent);
	})
	.catch(e => { console.log(e.message); });
};

//RouterLinkによりページが遷移したときに起こるイベント
function RouterLinkEvent() {
	state = false;
	seeking = false;
	prev = -1000;
	offset = -2000;
	//レーンの状態を初期化
	for (var i = 0; i < numLane; ++i) bLane.push({ "using": 0, "length": 0 });
	GetComments(gComments);
	//ビデオ要素の取得
	var videos = document.getElementsByTagName("video");
	if (videos.length == 0) {
		console.error("video要素が存在しません。");
		return;
	}
	var video = videos[0];
	//オフセットをリセット
	offset = NaN;
	//「続きから再生」されるとき、ページ読み込み後にコメント描画
	if (video.currentTime != 0) {
		var comments = document.querySelectorAll(".comment");
		for (var i = comments.length; i-- > 0;) comments[i].remove();
		animationStyle.sheet.deleteRule(0);
		animationStyle.sheet.insertRule(".comment{ animation-play-state: " + (state ? "running" : "paused") + " }", 0);
		update(-5000, false, video);
	}
};

//RouterLinkによるページ遷移を監視するMutationObserver
var observer = null;

//ページ読み込み時に作動するイベント
function loaded() {
	if (location.href.indexOf('nicovideo.') != -1) {
		var titles = document.getElementsByTagName("title");
		if (titles.length != 0) {
			var title = titles[0];
			observer = new MutationObserver(RouterLinkEvent);
			const config = {
				attributes: false,
				childList: true,
				characterData: true,
			};
			observer.observe(title, config);
			console.log("observer set!");
		}
		gInfo = new GetInfoForNiconico();
		gInfo.SetEvent();
	}
	else if (location.href.indexOf('amazon.') != -1) {
		gInfo = new GetInfoForAmazon();
		gInfo.SetEvent();
	}

	main();
};

//ドキュメントを操作するため、ロードが完了してから処理開始
window.onload = loaded;