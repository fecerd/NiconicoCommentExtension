import {SearchAPI} from "./js/search_api.js";
import {GetVideoPageAPI} from "./js/get_video_page_api.js";

chrome.runtime.onConnect.addListener(port => {
	if (port.name == "APIChannel") {
		port.onMessage.addListener(msg => {
			if (msg.APIName == "SearchAPI") {
				console.log("SeachAPI���b�Z�[�W���󂯎��܂����B");
				SearchAPI.fetch(msg.APIObject.word)
				.then(result => port.postMessage({ "status": true, "result": result }))
				.catch(e => port.postMessage({ "status":false, "result": "SearchAPI�����s���܂����B" }));
			}
			else if (msg.APIName == "GetVideoPageAPI") {
				console.log("GetVideoPageAPI���b�Z�[�W���󂯎��܂����B");
				GetVideoPageAPI.fetch(msg.APIObject.id)
				.then(result => port.postMessage({ "status": true, "result": result }))
				.catch(e => port.postMessage({ "status":false, "result": "GetVideoPageAPI�����s���܂����B" }));
			}
			else if (msg.APIName == "CommentServerAPI") {
				console.log("CommentServerAPI���b�Z�[�W���󂯎��܂����B");
				//�R�����g�T�[�o�[�Ƀ|�X�g
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
				.catch(e => port.postMessage({ "status":false, "result": "CommentServerAPI�����s���܂����B" }));
			}
			else {
				console.log("��`����Ă��Ȃ����b�Z�[�W���󂯎��܂����B");
				port.postMessage({ "status": false, "result": msg.APIName + "�͒�`����Ă��Ȃ�API���ł��B" });
			}
		});
	}
});