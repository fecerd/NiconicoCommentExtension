import {SearchAPI} from "./js/search_api.js";
import {GetVideoPageAPI} from "./js/get_video_page_api.js";

chrome.runtime.onConnect.addListener(port => {
	if (port.name == "APIChannel") {
		port.onMessage.addListener(msg => {
			if (msg.APIName == "SearchAPI") {
				console.log("SeachAPIメッセージを受け取りました。");
				SearchAPI.fetch(msg.APIObject.word)
				.then(result => port.postMessage({ "status": true, "result": result }))
				.catch(e => port.postMessage({ "status":false, "result": "SearchAPIが失敗しました。" }));
			}
			else if (msg.APIName == "GetVideoPageAPI") {
				console.log("GetVideoPageAPIメッセージを受け取りました。");
				GetVideoPageAPI.fetch(msg.APIObject.id)
				.then(result => port.postMessage({ "status": true, "result": result }))
				.catch(e => port.postMessage({ "status":false, "result": "GetVideoPageAPIが失敗しました。" }));
			}
			else if (msg.APIName == "CommentServerAPI") {
				console.log("CommentServerAPIメッセージを受け取りました。");
				//コメントサーバーにポスト
				var url = msg.APIObject.nvComment.server + "/v1/threads";
				var json = {
					"method": "POST",
					"headers": {
						"X-Frontend-Id": "6",
						"X-Frontend-Version": "0",
						"Content-Type": "application/json"
					},
					"body": JSON.stringify({
						"params": msg.APIObject.nvComment.params,
						"additionals": {},
						"threadKey": msg.APIObject.nvComment.threadKey
					})
				};
				fetch(url, json)
				.then(result => result.json())
				.then(result => port.postMessage({ "status": true, "result": result }))
				.catch(e => port.postMessage({ "status":false, "result": "CommentServerAPIが失敗しました。" }));
			}
			else {
				console.log("定義されていないメッセージを受け取りました。");
				port.postMessage({ "status": false, "result": msg.APIName + "は定義されていないAPI名です。" });
			}
		});
	}
});