///-----------------------------------------------
/// 型定義
///-----------------------------------------------

/**
 * @typedef VideoDetails 動画情報
 * @property {string} id 動画ID
 * @property {string} title 動画タイトル
 * @property {{ comment: number }} count 動画に関連する数値(コメント数)
 */

/**
 * @typedef VideoInfoResponse GetVideoInfoAPIが返す正常レスポンス
 * @property {string | null} channel_id チャンネルID
 * @property {boolean} quoted 引用コメントが存在するか
 * @property {VideoDetails} video 動画情報
 * 
 */

/**
 * @typedef CommentType コメント型
 * @property {number} vpos_ms コメントの時刻 (ms)
 * @property {string} data コメント文字列
 * @property {string[]} commands コメントの付加情報
 */

/**
 * @typedef SearchResultType 検索結果型
 * @property {{ status: number, id: string, totalCount: number }} meta
 * @property {{ channelId: number | null, commentCounter: number, contentId: string, lengthSeconds: number, thumbnailUrl: string, title: string }[]} data
 */

/**
 * @typedef BackgroundResponse バックグラウンドから返されるAPIレスポンス
 * @property {boolean} status 成功したか
 * @property {string | object} result statusがtrueのとき、APIのレスポンス(文字列かjsonオブジェクト)。statusがfalseのとき、エラー文字列。
 */


//

/**
 * @typedef VideoSize ビデオの描画サイズと上のY座標
 * @property {number} width ビデオの描画幅
 * @property {number} height ビデオの描画高さ
 * @property {number} top ビデオの上辺のY座標a
 */

/**
 * @typedef LaneState レーンの状態
 * @property {number} using このレーンを使用しているコメント要素の数
 * @property {number} length このレーンを使用しているコメントの最大文字数
 */


///-----------------------------------------------
/// 定数定義
///-----------------------------------------------

/** @type {number} コメントが流れるレーンの数 */
const NUM_LANE = 15;

/**
 * @type {number} コメントが流れるレーンのビデオ上辺からのマージン(px)
 * @description コメント要素を下にずらすために必要。
 */
const TOP_MARGIN = 15;

/**
 * @type {string} dAnimeストア ニコニコ支店のチャンネルID
 */
const D_ANIME_ID = "ch2632720";

/** @type {number} デフォルトのオフセット (ms) */
const DEFAULT_OFFSET_MS = -2000;

///-----------------------------------------------
/// グローバル変数定義
///-----------------------------------------------

/**
 * @type コメントのフォントサイズ。ChangeFontSizeStyle()内で更新される
 */
let g_medium_size = 30;

/** @type {string} 公式動画の動画ID */
let g_official_video_id = "";

/**
 * @type {number} 公式チャンネル動画の秒数。SearchAPIのrespose.data[0].lengthSecondsで更新する
 */
let g_official_duration_s = 0;

/**
 * @type {number} コメントの表示時刻のオフセット(ms)
 */
let g_offset_ms = DEFAULT_OFFSET_MS;

/** @type {GetInfoForNiconico | GetInfoForAmazon | null} 動画ページ情報と関連処理 */
let g_page_info = null;

/** @type {CommentType[]} 取得したコメントが時間順に入る配列 */
let g_comments = [];

/** @type {HTMLVideoElement | null} 現在のページのVideo要素 */
let g_video = null;

/** @type {HTMLDivElement | null} Video要素の親となるコメント描画領域用Div要素 */
let g_screen = null;

/**
 * @type {boolean} 動画再生中はtrue。動画停止中はfalse。
 * @description trueのときのみtimeupdateイベントでコメントを追加する
 */
let g_animation_running_state = false;

/** @type {boolean} 動画シーク中はtrue */
let g_video_seeking = false;

/** @type {number} 前回のtimeupdateイベント内で処理した最後のコメントの次のインデックス */
let g_next_comment_index = -1000;

/** @type {LaneState[]} 各レーンの状態。要素数は定数NUM_LANE */
let g_lane_states = [];

/** @type {HTMLStyleElement | null} コメントアニメーションの再生・停止を決めるスタイル */
let g_animation_style = null;

/** @type {boolean} CommonInitialize()が呼ばれたならtrue */
let g_initialized = false;

/** @type {number} Video要素が見つかるまで呼び出されるsetInterval関数の戻り値 */
let g_interval = -1;

///-----------------------------------------------
/// 関数定義
///-----------------------------------------------

/**
 * 文字列を装飾する
 * @param {string} str ログ出力したい文字列
 */
function Label(str) { return `CommentExtension: ${str}`; }

/**
 * 動画ページのタイトルから検索ワードを生成する
 * @param {string} title 動画ページのタイトル 
 * @returns {string} 検索ワード
 */
function BuildSearchWord(title) {
	let tmp = title
	.replace('　', ' ') // 全角スペースは半角に直しておく
	.replace("ニコニコ動画", " ") //タイトルにニコニコ動画が入っている場合があるので消しておく
	.replace("ニコニコ", " ") //タイトルにニコニコ動画が入っている場合があるので消しておく
	.replace("本編", " ")
	.replace(/第(\d+)話/g, '$1') // 第◯話 の第はない場合もあるので消しておく(けもフレ対応)
	.replace(/[「」『』]/g, ' ') // 括弧も表記揺れがあるので消しておく(バカテス対応)
	.replace(/\(.*\)/, ' ') // (.*) も消して良いと思う(シュタゲ9,10話対応)
	.replace(/【.*】/, ' '); // 日テレオンデマンド対応
	// 特殊系
	tmp = tmp.replace('STEINS;GATE', 'シュタインズ ゲート ') // (シュタゲ対応)
	.replace(/ (\d+)駅/g, ' $1')  // (輪るピングドラム対応 (第N駅 <-> Nth station ・第は除去済み))
	.replace(/episode(\d+)/g, "");	//魔法科高校の劣等生 来訪者編対応

	// TODO: ゼロサプレスするとファンタシースターオンラインが死ぬので何か考えないとだめそう... (複数回検索するなど)
	let mode = -1;
	if (tmp.indexOf("フレームアームズ・ガール") != -1) mode = 1;
	else if (tmp.indexOf("お兄ちゃんはおしまい") != -1) mode = 1;
	switch (mode){
		case 1:	// #(＃)NNまでで検索する
			let index = tmp.indexOf("#");
			if (index == -1) index = tmp.indexOf("＃");
			if (index == -1) break;
			tmp = tmp.substring(0, index + 3);
			break;
		default:
			tmp = tmp.replace(/0+([0-9]+)/, "$1" ) // ゼロサプレス(とある魔術の禁書目録対応)
			.replace(/[#.\-"'<>]/g, ' '); // 記号系はスペースに変換しちゃっていいんじゃないかなあ。ダメなケースもあるかも(君に届け対応)
	}

	// 虹ヶ咲学園スクールアイドル同好会2話対応
	if (tmp.indexOf("※") >= 0){
		if (tmp.indexOf("ラブライブ") >= 0){
			tmp = tmp.replace("◇", "?").substring(0, tmp.indexOf("※") - 1);
		}
	}
	return tmp;	
}

/**
 * ビデオの描画サイズと左上のY座標を取得する
 * @param {HTMLVideoElement} video Video要素
 * @returns {VideoSize} ビデオの描画サイズと上のY座標
 */
function GetVideoSize(video) {
	let origin_h, origin_w;
	if (video.videoWidth !== 0 && video.videoHeight !== 0) {
		origin_w = video.videoWidth;
		origin_h = video.videoHeight;	
	}
	else {
		origin_w = video.clientWidth;
		origin_h = video.clientHeight;
	}

	const origin_aspect = origin_h /origin_w;

	const tag_w = video.clientWidth;
	const tag_h = video.clientHeight;
	const tag_aspect = tag_h /tag_w;

	let screen_w, screen_h;
	if (origin_aspect > tag_aspect) {
		screen_h = video.clientHeight;
		screen_w = screen_h / origin_aspect;
	} else {
		screen_w = video.clientWidth;
		screen_h = screen_w * origin_aspect;
	}
	return { width: screen_w, height: screen_h, top: (tag_h - screen_h) / 2 };
}

/**
 * キーフレームのアニメーション属性をStyle要素に追加する
 * @param {HTMLStyleElement} style Style要素
 * @param {VideoSize} video_size ビデオの描画サイズと上のY座標
 */
function ChangeKeyFrameInfo(style, video_size) {
	const width = video_size.width;
	const height = video_size.height;
	const top = video_size.top;
	const fixed_width = Number(width.toFixed());

	/** @type {number} NUM_LANE等分した高さ */
	const line_height = height / NUM_LANE;
	/** @type {number} アニメーションが終了するX座標 */
	const left = fixed_width * -2;
	// 各コメントレーンの流れるアニメーションスタイルを追加する
	for (let i = 0; i < NUM_LANE; ++i) {
		/** @type {number} コメントレーンのY座標 */
		const h = Number((TOP_MARGIN + top + line_height * i).toFixed());
		/** @type {string} 追加するスタイル */
		const text = `@keyframes lane${i}{ from { transform: translate(${fixed_width}px, ${h}px); } to { transform: translate(${left}px, ${h}px); } }`;
		style.sheet.insertRule(text, style.sheet.cssRules.length);
	}

	// 各コメントレーンの中央コメントアニメーションスタイルを追加する
	for (let i = 0; i < NUM_LANE; ++i) {
		/** @type {number} コメントレーンのY座標 */
		const h = Number((TOP_MARGIN + top + line_height * i).toFixed());
		const text = `@keyframes center${i}{ from { transform: translate(-50%, ${h}px); } to { transform: translate(-50%, ${h}px); } }`;
		style.sheet.insertRule(text, style.sheet.cssRules.length);
	}
}

/**
 * コメントのフォントサイズスタイルを設定する
 * @param {HTMLStyleElement} style Style要素
 * @param {number} video_height ビデオの描画高さ
 */
function ChangeFontSizeStyle(style, video_height) {
	g_medium_size = Math.ceil(video_height / (NUM_LANE + 1));
	style.sheet.insertRule(`.medium { font-size: ${g_medium_size}px; }`, 0);
	style.sheet.insertRule(`.big { font-size: ${g_medium_size * 1.5}px; }`, 1);
	style.sheet.insertRule(`.small { font-size: ${g_medium_size / 1.5}px; }`, 2);
	style.sheet.insertRule(`.xsmall { font-size: ${g_medium_size / 2.0}px; }`, 3);
	style.sheet.insertRule(`.xxsmall { font-size: ${g_medium_size / 3.0}px; }`, 4);
}

/**
 * API名と引数をバックグラウンドに渡して、レスポンスを待つPromiseを生成する
 * @param {string} api_name APIクラス名
 * @param {object} api_object APIクラスの持つfetch()関数のとる引数をまとめたオブジェクト
 * @returns {Promise<string | object>} APIレスポンスの値
 */
async function SendAPI(api_name, api_object) {
	const unique_name = `APIChannel_${Date.now()}`
	const port = chrome.runtime.connect({ name: unique_name });
	return await new Promise((resolve) => {
		// background.js内で定義しているchrome.runtime.onConnect.addListenerのコールバックが呼び出される
		port.postMessage({ APIName: api_name, APIObject: api_object });
		port.onMessage.addListener(
			/** @param {BackgroundResponse} msg background.js内からport.postMessage()で返されるレスポンスを受け取る */
			msg => {
				resolve(msg.result);
			}
		);
	});
}

/**
 * コメント描画時刻のオフセットを更新する
 * @param {HTMLVideoElement} g_video Video要素
 * @param {string} title 動画ページのタイトル
 */
function CalcOffset(title) {
	/**
	 * オフセット値の特殊化
	 * @description 前方オフセット値を返すcalc関数を設定する。後方オフセットなら0を返すようにする。
	 */
	const specializations = [
		{
			word: null,
			calc: (current_s, official_s) => {
				const ret = (current_s - official_s) * 1e3;
				return isFinite(ret) ? ret : DEFAULT_OFFSET_MS;
			}
		},
		{
			word: "けいおん！！",
			children: [
				{
					word: null,
					calc: (current_s, official_s) => -19 * 1e3
				},
				{
					word: "第1話",
					calc: (current_s, official_s) => -10 * 1e3
				},
			]
		},
		{
			word: "マギアレコード",
			calc: (current_s, official_s) => 0
		},
		{
			word: "WORKING’!!",
			calc: (current_s, official_s) => 0
		}
	];

	/**
	 * タイトル名からオフセット設定を取得する
	 * @param {any} self 再帰用
	 * @param {Array} target_array 上記のspecializationsか見つかったオブジェクトのchildren
	 * @param {string} title タイトル名
	 * @param {string[]} words 検索でヒットした文字列の配列
	 */
	const get_specialization = (self, target_array, title, words) => {
		if (!words) words = [];
		for (const target of target_array)
		{
			if (target.word === null) continue;
			if (title.includes(target.word)) {
				words.push(target.word);
				if (target.calc !== undefined) return { result: target, words: words };
				else return self(self, target.children, title, words);
			}
		}
		return { result: target_array[0], words: words };
	};

	const spec = get_specialization(get_specialization, specializations, title, []);
	/** @type {string[]} */
	const words = spec.words;
	/** @type {(current_s: number, official_s: number) => number} */
	const calc = spec.result.calc;

	// オフセット値を更新
	g_offset_ms = calc(g_video.duration, g_official_duration_s);
	console.log(Label(`オフセット検索ワード: ${words}`));
	console.log(Label(`現在の動画: ${g_video.duration}秒\n公式動画: ${g_official_duration_s}秒\nオフセット: ${g_offset_ms / 1e3}秒`));
}


// async function IsOfficial() {
// 	//この動画のIDを取得(公式引用確認のため)
// 	var splits = location.href.split('/');
// 	var currentID = null;
// 	for (var i = splits.length; i-- > 0;) {
// 		if (splits[i].startsWith("so")) {
// 			currentID = splits[i];
// 			break;
// 		}
// 	}
// 	if (currentID == null) return Promise.reject(new Error("この動画のIDが取得できませんでした。"));
// 	//公式引用の確認(スレッドのIDが3種類以上あるとき、引用あり)
// 	return await SendAPI("GetVideoPageAPI", { "id": currentID })
// 	.then(text => new DOMParser().parseFromString(text, "text/html"))
// 	.then(doc => ({ "doc": doc, "el": doc.getElementById("js-initial-watch-data") }))
// 	.then(obj => ({ "doc": obj.doc, "js": JSON.parse(obj.el.getAttribute("data-api-data")) }))
// 	.then(obj => {
// 		//dアニメ動画か確認
// 		if (obj.js.channel.id != D_ANIME_ID) {
// 			console.log("この動画はdアニメ ニコニコ支店のものではありません。");
// 			return Promise.reject(new Error());
// 		}
// 		else return { "doc": obj.doc, "threads": obj.js.comment.threads };
// 	})
// 	.then(obj => {
// 		var ids = new Array();
// 		for (var i = 0; i < obj.threads.length; ++i) {
// 			if (!ids.includes(obj.threads[i].id)) ids.push(obj.threads[i].id);
// 		}
// 		return { "doc": obj.doc, "length": ids.length };
// 	})
// 	.then(obj => {
// 		if (obj.length > 2) return Promise.reject(new Error("この動画には既に公式動画からの引用コメントが存在します。"));
// 		else return obj;
// 	})
// 	.catch(e => ({ "doc": null, "length": -1 }));
// }

// async function GetComments() {
// 	//コメント配列を削除
// 	comments.splice(0);
// 	//非同期処理を同期実行
// 	await g_page_info.AsnycEvent();
// 	//動画タイトルから検索キーワードを生成
// 	var word = buildSearchWord(g_page_info.GetTitleName());
// 	console.log("タイトル: " + word + " に一致する一番コメントの多い動画を検索します。");

// 	//コメントを取得
// 	const r = await SendAPI("SearchAPI", { "word": word })
// 	.then(ret => {
// 		if (ret.data.length == 0) return Promise.reject(new Error("検索結果が存在しませんでした。"));
// 		console.log("検索結果は以下の動画です。\nタイトル: " + ret.data[0].title + "\nコメント数: " + ret.data[0].commentCounter);
// 		g_official_duration_s = ret.data[0].lengthSeconds;
// 		if (ret.data[0].channelId != undefined) return ret.data[0].contentId; 
// 		else return Promise.reject(new Error("検索結果がチャンネル動画ではありませんでした。"));
// 	})
// 	.then(id => SendAPI("GetVideoPageAPI", { "id": id }))
// 	.then(text => new DOMParser().parseFromString(text, "text/html"))
// 	.then(doc => doc.getElementById("js-initial-watch-data"))
// 	.then(el => JSON.parse(el.getAttribute("data-api-data")))
// 	.then(js => js.comment.nvComment)
// 	.then(nvComment => SendAPI("CommentServerAPI", { "nvComment": nvComment }))
// 	.then(result => {
// 		var threads = result.data.threads;
// 		var index = -1;
// 		for (var i = 0; i < threads.length; ++i) {
// 			if (threads[i].commentCount != 0 && threads[i].fork == "main") {
// 				index = i;
// 				break;
// 			}
// 		}
// 		if (index < 0) return Promise.reject(new Error("検索した動画にはコメントがありません。"));
// 		var thread = threads[index];
// 		for (var i = 0; i < thread.comments.length; ++i) {
// 			comments.push({ "vposMs": Number(thread.comments[i].vposMs), "data": thread.comments[i].body, "commands": thread.comments[i].commands });
// 		}
// 		comments.sort((a, b) => Number.isNaN(a.vposMs) || Number.isNaN(b.vposMs) ? (Number.isNaN(a.vposMs) ? (Number.isNaN(b.vposMs) ? 0 : 1) : -1) : a.vposMs - b.vposMs);
// 		return comments.length + "個のコメントを表示します。";
// 	})
// 	.then(result => { return { "status": true, "result": result }; })
// 	.catch(e => { return { "status": false, "result": "コメント取得に失敗しました。\nメッセージ: " + e.message }; });
// 	if (r.status) console.log(r.result);
// 	else return Promise.reject(new Error(r.result));
// }

function SetVideo() {
	const video = document.getElementsByTagName("video")[0];
	g_video = video ? video : null;
	if (g_video && g_video.duration >= 0) {
		console.info("Video要素が見つかりました。");
		CalcOffset(g_page_info.m_video_title);
	}
	else {
		g_video = null;
	}
}

/**
 * コメントをスクリーンに追加する
 * @param {number} start_offset_ms シーク直後の描画で使用されるコメントの範囲。現在時刻からのマイナス時間で設定(ms)
 * @param {boolean} is_time_update timeupdateイベントから呼ばれるとき、true
 * @returns 
 */
function AddComments(start_offset_ms, is_time_update) {
	// ビデオ要素がないとき処理しない
	if (!g_video) return;
	// timeupdateイベント時、アニメーションがfalseなら処理しない
	if (is_time_update && !g_animation_running_state) return;
	// シーク中は処理しない
	if (g_video_seeking) return;
	// コメントが取得されていないとき処理しない
	if (g_comments.length == 0) return;

	// 現在の再生時刻 (ms)
	const current_ms = Number((g_video.currentTime * 1e3).toFixed());
	// シーク直後はstart_offset(ms)前のコメントから表示する
	if (g_next_comment_index < 0) {
		const start_time = current_ms + start_offset_ms;
		const next_index = g_comments.findIndex(x => x.vpos_ms > start_time);
		if (next_index >= 0) g_next_comment_index = next_index;
		// start_timeより後のコメントが存在しないなら何もしない
		if (g_next_comment_index < 0) return;
	}
	// この呼び出しで追加されるコメントの最大時刻 (ms)
	// 次のtimeupdateまで時間があるため現時刻よりも多めに流す
	const end_time_ms = current_ms + 150;
	if (!g_comments[g_next_comment_index]) return;

	for (let i = g_next_comment_index; i < g_comments.length; ++i) {
		const vpos_ms = g_comments[i].vpos_ms;
		const pos_ms = vpos_ms + g_offset_ms;
		if (pos_ms < 0) continue;
		else if (pos_ms <= end_time_ms) {
			// spanタグを生成する
			const el = document.createElement('span');
			const text = document.createTextNode(g_comments[i].data);
			el.appendChild(text);
			el.style.color = "white";
			// spanタグの持つcomment以外のクラス
			const classes = [];
			classes.push("comment");
			// コマンド処理
			let big_small = 0;
			let is_defont = true;
			let ue_shita = 0;
			if (g_comments[i].commands.length != 0) {
				const commands = g_comments[i].commands;
				for (let j = 0; j < commands.length; ++j) {
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
							big_small = 1;
							break;
						case "small":
							big_small = -1;
							break;
						case "gothic":
						case "mincho":
							is_defont = false;
							classes.push(commands[j]);
							break;
						case "ue":
							ue_shita = 1;
							break;
						case "shita":
							ue_shita = -1;
							break;
					}
				}
			}
			// 仮レーンID ([0, NUM_LANE - 1]の乱数)
			const tmp_id = Math.floor(Math.random() * NUM_LANE);
			// どのレーンに流すか決める
			let lane_id = tmp_id;
			// 非固定コメント
			if (ue_shita == 0) {
				// 使われていないレーンを探す(1)
				for (; lane_id < NUM_LANE; ++lane_id) {
					if (g_lane_states[lane_id].using <= 0) break;
				}
				if (lane_id == NUM_LANE) {
					lane_id = 0;
					// 使われていないレーンを探す(2)
					for (; lane_id < tmp_id; ++lane_id) {
						if (g_lane_states[lane_id].using <= 0) break;
					}
					// すべてのレーンが使われている場合、末尾が一番左側にあるレーンを使用する
					if (lane_id == tmp_id) {
						let len = Infinity;
						for (let j = 0; j < NUM_LANE; ++j) {
							if (g_lane_states[j].length < len) {
								len = g_lane_states[j].length;
								lane_id = j;
							}
						}
					}
				}
				el.id = `lane${lane_id}`;
			}
			// 上下固定コメント
			else {
				// 上固定
				if (ue_shita > 0) {
					lane_id = 0;
					for (; lane_id < NUM_LANE; ++lane_id) if (g_lane_states[lane_id].length != Infinity) break;
					if (lane_id == NUM_LANE) {
						lane_id = 0;
						let using = Infinity;
						for (let j = 0; j < NUM_LANE; ++j) {
							if (g_lane_states[j].using < using) {
								using = g_lane_states[j].using;
								lane_id = j;
							}
						}
					}
				}
				// 下固定
				else {
					lane_id = NUM_LANE;
					for (; lane_id-- > 0;) if (g_lane_states[lane_id].length != Infinity) break;
					if (lane_id < 0) {
						lane_id = NUM_LANE - 1;
						let using = Infinity;
						for (let j = NUM_LANE; j-- > 0;) {
							if (g_lane_states[j].using < using) {
								using = g_lane_states[j].using;
								lane_id = j;
							}
						}
					}
				}
				el.id = "center" + lane_id.toString();
			}
			// クラスを設定
			if (ue_shita == 0) {
				if (big_small == 0) classes.push("medium");
				else classes.push(big_small > 0 ? "big" : "small");
			}
			else {
				const video_size = GetVideoSize(g_video);
				const comment_width_px = g_comments[i].data.length * g_medium_size;
				if (big_small > 0 && (comment_width_px * 1.5 < video_size.width)) classes.push("big");
				else if (comment_width_px < video_size.width) classes.push("medium");
				else if (comment_width_px / 1.5 < video_size.width) classes.push("small");
				else if (comment_width_px / 2.0 < video_size.width) classes.push("xsmall");
				else classes.push("xxsmall");
			}
			if (is_defont) classes.push("defont");
			el.classList.add(...classes);
			// レーン使用数を増やす
			++g_lane_states[lane_id].using;
			// 一文字を(5000 / 30)msに換算してレーン末尾の位置とする
			const len = ue_shita == 0 ? pos_ms + Math.floor(g_comments[i].data.length * (5000.0 / 30)) : Infinity;
			if (g_lane_states[lane_id].length < len) g_lane_states[lane_id].length = len;
			// 現在の再生時間から見たコメント時間の位置(s)
			const delay_s = (pos_ms - current_ms) / 1e3;
			if (ue_shita == 0) {
				// 再生中はコメントスピードを変化させる
				if (is_time_update) {
					el.style.animationDuration = `${10 + delay_s}s`;
				}
				// シーク後は表示位置を前後させる
				else {
					el.style.animationDelay = `${delay_s}s`;
				}
			}
			// アニメーションが終わった時点で自身を削除する
			el.addEventListener(
				"animationend",
				entries => {
					const idname = entries.target.id;
					let id = NUM_LANE;
					if (idname.startsWith("lane")) id = Number(idname.substring(4));
					else if (idname.startsWith("center")) {
						id = Number(idname.substring(6));
						if (id < NUM_LANE) g_lane_states[id].length = -1;
					}
					if (id < NUM_LANE) --g_lane_states[id].using;
					g_screen.removeChild(entries.target);
				},
				false
			);
			g_screen.appendChild(el);
		}
		else {
			g_next_comment_index = i;
			break;
		}
	}
};

/**
 * 「続きから再生」されるとき、ページ読み込み後にコメント描画
 */
function SettingAtContinueWatching() {
	if (g_video.currentTime != 0) {
		g_next_comment_index = -1000;
		const comments = document.querySelectorAll(".comment");
		for (let i = comments.length; i-- > 0;) comments[i].remove();
		g_animation_style.sheet.deleteRule(0);
		g_animation_style.sheet.insertRule(`.comment{ animation-play-state: ${g_animation_running_state ? "running" : "paused"} }`, 0);
		AddComments(-5000, false);
	}
}

/**
 * ページ切り替えごとに呼び出す
 */
async function CommonInitialize() {
	if (!g_page_info) {
		console.error(`ページ情報クラスが生成されませんでした。`);
		return;
	}
	if (!g_video) {
		console.log(`Video要素が見つかりませんでした。`);
		return;
	}

	// #screenのスタイルを追加
	const screen_style = document.createElement('style');
	document.head.appendChild(screen_style);
	screen_style.sheet.insertRule("#screen{ background-color: #000; width: 100%; height: 100%; overflow: hidden; white-space: nowrap; cursor:default; -ms-user-select: none; -moz-user-select: none; -webkit-user-select: none; user-select: none; position: relative; }", 0);
	// #lane[0,NUM_LANE)のスタイルを追加
	const lane_style = document.createElement('style');
	document.head.appendChild(lane_style);
	// アニメーション用のスタイルを追加
	for (let i = 0; i < NUM_LANE; ++i) {
		const flow_text = `#lane${i}{ animation-name: lane${i}; animation-timing-function: linear; animation-duration: 10s; animation-fill-mode: forwards; }`;
		lane_style.sheet.insertRule(flow_text, i * 2);
		const center_text = `#center${i}{ animation-name: center${i}; animation-timing-function: linear; animation-duration: 3s; animation-fill-mode: forwards; }`;
		lane_style.sheet.insertRule(center_text, i * 2 + 1);
	}
	// .commentのスタイルを追加
	const comment_style = document.createElement('style');
	document.head.appendChild(comment_style);
	for (let i = 0; i < NUM_LANE; ++i) {
		comment_style.sheet.insertRule(`#center${i}{ left: 50%; }`, i);
	}
	comment_style.sheet.insertRule(".comment{ position: absolute; letter-spacing: 1px; padding: 2px 0 2px; white-space: nowrap; z-index: 2; }", 0);
	comment_style.sheet.insertRule(".comment{ opacity: 0.5; font-weight: 600; line-height: 29px; text-shadow: black 1px 0px, black -1px 0px, black 0px -1px, black 0px 1px, black 1px 1px , black -1px 1px, black 1px -1px, black -1px -1px, black 0px 1px, black -0px 1px, black 0px -1px, black -0px -1px, black 1px 0px, black -1px 0px, black 1px -0px, black -1px -0px; }", 1);
	// .commentのアニメーションスタイルを追加
	const animation_style = document.createElement('style');
	document.head.appendChild(animation_style);
	animation_style.sheet.insertRule(".comment{ animation-play-state: running }", 0);
	// フォントファミリーのスタイルを設定
	const font_name_style = document.createElement('style');
	document.head.appendChild(font_name_style);
	const defont = "'Arial', sans-serif";
	const gothic = '"Hiragino Sans W3", "Hiragino Kaku Gothic ProN", "ヒラギノ角ゴ ProN W3", "メイリオ", Meiryo, "ＭＳ Ｐゴシック", "MS PGothic", sans-serif';
	const mincho = '"游明朝", YuMincho, "Hiragino Mincho ProN W3", "ヒラギノ明朝 ProN W3", "Hiragino Mincho ProN", "HG明朝E", "ＭＳ Ｐ明朝", "ＭＳ 明朝", serif';
	font_name_style.sheet.insertRule(`.defont { font-family: ${defont}; }`, 0);
	font_name_style.sheet.insertRule(`.gothic { font-family: ${gothic}; }`, 1);
	font_name_style.sheet.insertRule(`.mincho { font-family: ${mincho}; }`, 2);

	// ビデオサイズ
	const video_size = GetVideoSize(g_video);
	// キーフレームのスタイルを追加
	const key_frame_style = document.createElement('style');
	document.head.appendChild(key_frame_style);
	ChangeKeyFrameInfo(key_frame_style, video_size);
	// フォントサイズのスタイルを追加
	const font_size_style = document.createElement('style');
	document.head.appendChild(font_size_style);
	ChangeFontSizeStyle(font_size_style, video_size.height);

	// コメント用スクリーンの追加
	const parent = g_video.parentElement;
	g_screen = document.createElement('div');
	g_screen.id = 'screen';
	parent.appendChild(g_screen);
	g_screen.appendChild(g_video);
	// イベントの追加
	// 動画が停止したとき、コメントを止める
	g_video.addEventListener(
		"pause",
		() => {
			g_animation_running_state = false;
			animation_style.sheet.deleteRule(0);
			animation_style.sheet.insertRule(".comment{ animation-play-state: paused }", 0);
		},
		false
	);
	// 動画の再生が始まったとき、コメントを流し始める
	g_video.addEventListener(
		"play",
		() => {
			g_animation_running_state = true;
			animation_style.sheet.deleteRule(0);
			animation_style.sheet.insertRule(".comment{ animation-play-state: running }", 0);
		},
		false
	);
	// 動画の再生が終わったとき、最後までコメントを流しきる
	g_video.addEventListener(
		"ended",
		() => {
			g_animation_running_state = false;
			animation_style.sheet.deleteRule(0);
			animation_style.sheet.insertRule(".comment{ animation-play-state: running }", 0);
		},
		false
	);
	// シーク操作が開始したとき、描画中のコメントを削除する
	g_video.addEventListener(
		"seeking",
		() => {
			g_video_seeking = true;
			g_next_comment_index = -1000;
			g_lane_states = [...Array(NUM_LANE)].map(() => ({ using: 0, length: 0 }));
			const comments = document.querySelectorAll(".comment");
			for (let i = comments.length; i-- > 0;) comments[i].remove();
		},
		false
	);
	// シーク操作が終わったとき、コメントを描画する
	g_video.addEventListener(
		"seeked",
		() => {
			g_video_seeking = false;
			AddComments(-5000, false);
		},
		false
	);
	// 再生中に呼ばれるイベント
	g_video.addEventListener(
		"timeupdate",
		() => {
			if (g_animation_running_state == g_video.paused) {
				g_animation_running_state = !g_video.paused;
				animation_style.sheet.deleteRule(0);
				animation_style.sheet.insertRule(`.comment{ animation-play-state: ${g_animation_running_state ? "running" : "paused"} }`, 0);
			}
			AddComments(-2000, true);
		},
		false
	);

	// 「続きから再生」対応
	SettingAtContinueWatching();

	// リサイズ時、コメントサイズとアニメーションの範囲を変更する
	const observer = new ResizeObserver(
		() => {
			const video_size = GetVideoSize(g_video);
			// キーフレームのスタイルをすべて更新
			while (key_frame_style.sheet.cssRules.length != 0) {
				key_frame_style.sheet.deleteRule(key_frame_style.sheet.cssRules.length - 1);
			}
			ChangeKeyFrameInfo(key_frame_style, video_size);
			// フォントサイズ(#medium, #big, #small)のスタイルをすべて更新
			while (font_size_style.sheet.cssRules.length != 0) {
				font_size_style.sheet.deleteRule(font_size_style.sheet.cssRules.length - 1);
			}
			ChangeFontSizeStyle(font_size_style, video_size.height);
		}
	);
	observer.observe(parent);
};

/**
 * 
 */
function SetInitialize() {
	if (g_interval !== -1) {
		clearInterval(g_interval);
		g_interval = -1;
	}

	g_interval = setInterval(() => {
		if (g_initialized) {
			clearInterval(g_interval);
			g_interval = -1;
			return;
		}

		g_video = null;
		SetVideo();
		if (g_video) {
			// メイン処理
			CommonInitialize();
			g_initialized = true;
			clearInterval(g_interval);
			g_interval = -1;
		}
	}, 100);
}

class GetInfoForNiconico {
	/** @type {MutationObserver | null} 動画ページのTitle要素の更新を監視するMutationObserver */
	m_title_observer = null;

	/** @type {string | null} この動画のsoから始まる動画ID */
	m_video_id = null;

	/** @type {string | null} 動画のタイトル名 */
	m_video_title = null;

	/** @type {boolean} dアニメストア ニコニコ支店の動画ならtrue */
	m_is_d_anime = false;

	/** @type {boolean} 自動引用コメントがあるならtrue */
	m_quoted = false;

	/** @type {number} この動画のコメント数 */
	m_comment_count = 0;

	/** このインスタンスの持つ情報を更新する */
	async _UpdateInfo() {
		// 動画IDの更新
		const video_id = location.pathname.split('/').reverse().find(x => x.startsWith("so"));
		this.m_video_id = video_id ? video_id : null;

		/** @type {string | VideoInfoResponse} */
		const res = await SendAPI("GetVideoInfoAPI", { video_id: this.m_video_id });

		if (typeof(res) === 'string') {
			console.error(`GetInfoForNiconico::Initialize ${res}`);
			return;
		}

		this.m_is_d_anime = res.channel_id === D_ANIME_ID;
		this.m_quoted = res.quoted;
		this.m_video_id = res.video.id;
		this.m_video_title = res.video.title;
		this.m_comment_count = res.video.count.comment;
	}

	/** 公式動画情報を更新する */
	async _UpdateOfficial() {
		// 公式情報を削除
		g_comments = [];
		g_official_duration_s = 0;
		g_official_video_id = "";

		if (this.m_quoted) {
			console.log(Label("GetInfoForNiconico.UpdateComments すでに引用コメントが存在するため何もしません。"));
			return;
		}
		if (!this.m_is_d_anime) {
			console.log(Label("GetInfoForNiconico.UpdateComments dアニメ ニコニコ支店の動画以外では何もしません。"));
			return;
		}

		// 動画タイトルから検索ワードを生成
		const word = BuildSearchWord(this.m_video_title);
		console.info(Label(`GetInfoForNiconico.UpdateComments タイトル"${word}"に一致する一番コメントの多い動画を検索します。`));

		/** @type {string | SearchResultType} */
		const search_res = await SendAPI("SearchAPI", { word: word });

		if (typeof(search_res) === 'string') {
			console.error(Label(`GetInfoForNiconico.UpdateComments ${search_res}`));
			return;
		}
		if (!search_res.data || search_res.data.length === 0) {
			console.error(Label(`GetInfoForNiconico.UpdateComments 動画検索結果がありませんでした。`));
			return;
		}
		if (typeof(search_res.data[0].channelId) !== 'number') {
			console.error(Label(`GetInfoForNiconico.UpdateComments 検索結果が公式チャンネル動画ではありませんでした。\nタイトル: ${official.title}\nコメント数:${official.commentCounter}`));
			return;
		}

		// 公式動画情報
		const official = search_res.data[0];
		const duration_s = official.lengthSeconds;
		const video_id = official.contentId;
		console.info(Label(`GetInfoForNiconico.UpdateComments 検索結果は以下の動画です。\nタイトル: ${official.title}\nコメント数:${official.commentCounter}`));

		/** @type {string|CommentType[]} */
		const comment_res = await SendAPI("GetCommentAPI", { video_id: video_id });
		if (typeof(comment_res) === 'string') {
			console.error(Label(`GetInfoForNiconico.UpdateComments ${comment_res}`));
			return;
		}

		// 公式動画時間を更新
		g_comments = comment_res.sort((a, b) => a.vpos_ms - b.vpos_ms);
		g_official_duration_s = duration_s;
		g_official_video_id = video_id;

		console.info(Label(`GetInfoForNiconico.UpdateComments ${g_comments.length}個のコメントを表示します。`));
	}

	/** 生成直後に呼び出す。初期化処理 */
	async Initialize() {
		// 情報更新
		await this._UpdateInfo();

		// 最初のコメント取得処理
		await this._UpdateOfficial();

		// グローバル変数の初期化
		g_animation_running_state = false;
		g_video_seeking = false;
		g_next_comment_index = -1000;
		g_offset_ms = DEFAULT_OFFSET_MS;
		g_lane_states = [...Array(NUM_LANE)].map(() => ({ using: 0, length: 0 }));

		// Title要素の監視開始
		const title = document.querySelector("title");
		if (title) {
			this.m_title_observer = new MutationObserver(this._TitleObserverCallback.bind(this));
			const config = {
				attributes: false,
				childList: true,
				characterData: true,
				subtree: true
			};
			this.m_title_observer.observe(document.querySelector('title'), config);
			console.log(Label("SetEvent MutationObserver start"));
		}

		// 引用コメントを描画できるなら初期化処理
		if (!this.m_quoted && this.m_is_d_anime && g_comments.length !== 0) {
			SetInitialize();
		}
	}

	/** title_observerのコールバック */
	async _TitleObserverCallback() {
		// グローバル変数の初期化
		g_animation_running_state = false;
		g_video_seeking = false;
		g_next_comment_index = -1000;
		g_lane_states = [...Array(NUM_LANE)].map(() => ({ using: 0, length: 0 }));
		g_offset_ms = NaN;

		await this._UpdateInfo();
		await this._UpdateOfficial();

		// TODO: g_videoの指す要素が変わってしまっているっぽい

		// 引用コメントを描画できるなら初期化処理
		if (!this.m_quoted && this.m_is_d_anime && g_comments.length !== 0) {
			SetInitialize();
		}

		// 引用コメントを描画できるかつ未初期化なら初期化処理
		if (!this.m_quoted && this.m_is_d_anime && g_comments.length !== 0) {
			if (!g_initialized) {
				SetInitialize();
			}
			else {
				// 「続きから再生」対応
				SettingAtContinueWatching();
			}
		}
	}
}

// class GetInfoForAmazon {
// 	webplayer = null;
// 	video = null;
// 	title = null;
// 	subtitle = null;
// 	titleName = null;
// 	loadObserver = null;
// 	titleObserver = null;
// 	_GetTitle() {
// 		if (!this.title || !this.subtitle) {
// 			if (this.titleObserver) this.titleObserver.disconnect();
// 			this.titleName = null;
// 			this.SetEvent();
// 			return;
// 		}
// 		var titleText = this.title.textContent;
// 		var subtitleText = this.subtitle.textContent;
// 		subtitleText = subtitleText
// 			.replace(/シーズン\d?\d*/, ' ')
// 			.replace('エピソード', ' ')
// 			.replace('「', '')
// 			.replace('」', '')
// 			.replace('、', '');
// 		this.titleName = titleText + subtitleText;
// 		if (!this.titleName) {
// 			this.titleName = null;
// 			return;
// 		}
// 		console.log("_GetTitle: " + this.titleName);
// 	}
// 	_Load() {
// 		if (!this.webplayer) {
// 			this.webplayer = document.getElementById("dv-web-player");
// 			if (!this.webplayer) return;
// 		}
// 		this.video = this.webplayer.getElementsByTagName("video").item(0);
// 		if (!this.video) return;
// 		this.title = this.webplayer.querySelector('[class*="-title-text"]')
// 		this.subtitle = this.webplayer.querySelector('[class*="-subtitle-text"]');
// 		if (!this.title || !this.subtitle) return;
// 		this.loadObserver.disconnect();
// 		this.loadObserver = null;
	
// 		this._GetTitle();
// 		this.titleObserver = new MutationObserver(this._GetTitle.bind(this));
// 		this.titleObserver.observe(
// 			this.subtitle,
// 			{
// 				childList: true,
// 				attributes: true,
// 				characterData: true,
// 				subtree: true
// 			}
// 		);
// 		console.log("Set _GetTitle Observer.");
// 	}
// 	SetEvent() {
// 		this.webplayer = document.getElementById("dv-web-player");
// 		if (!this.webplayer) {
// 			console.log("webplayerがありません。");
// 			return;
// 		}
// 		this.loadObserver = new MutationObserver(this._Load.bind(this));
// 		this.loadObserver.observe(
// 			this.webplayer,
// 			{
// 				childList: true,
// 				subtree: true
// 			}
// 		);
// 	}
// 	async AsnycEvent() {
// 		var timer = null;
// 		timer = setInterval(
// 			(name, timer) => {
// 				if (name != null) clearInterval(timer);
// 			}
// 			, 10, this.titleName, timer
// 		);
// 	}
// 	GetTitleName() { return this.titleName; }
// 	GetVideoTag() { return this.video; }
// }

/** ページ読み込み時に作動するイベント */
async function OnPageLoaded() {
	// ニコニコのとき
	if (location.href.indexOf('nicovideo.') != -1) {
		g_page_info = new GetInfoForNiconico();
		await g_page_info.Initialize();
	}
	// アマゾンのとき
	else if (location.href.indexOf('amazon.') != -1) {
		console.log(Label("amazon prime not supported."));
		// g_page_info = new GetInfoForAmazon();
		// g_page_info.SetEvent();
	}
};

function OnPageBeforeUnload() {
	if (g_interval !== -1) {
		clearInterval(g_interval);
		g_interval = -1;
	}
}

// ドキュメントを操作するため、ロードが完了してから処理開始
window.onload = OnPageLoaded;
// clearInterval用
window.onbeforeunload = OnPageBeforeUnload;
