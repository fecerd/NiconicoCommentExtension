import './js/api_jsdoc.js'
import {SearchAPI} from './js/SearchAPI.js'
import {GetVideoInfoAPI} from './js/GetVideoInfoAPI.js'
import {GetCommentAPI} from './js/GetCommentAPI.js'

/**
 * @param {*} port
 * @param {{ APIName: string, APIObject: object }} msg 
 */
async function OnMessageCallback(port, msg) {
	switch (msg.APIName) {
		case "SearchAPI": {
			console.info(`OnMessageCallback: ${msg.APIName}を受け取りました。`);
			await SearchAPI.fetch(msg.APIObject.word)
			.then(res => port.postMessage({ status: true, result: res }))
			.catch(e => port.postMessage({ status: false, result: e }));
			break;
		}
		case "GetVideoInfoAPI": {
			console.info(`OnMessageCallback: ${msg.APIName}を受け取りました。`);
			await GetVideoInfoAPI.fetch(msg.APIObject.video_id)
			.then(res => port.postMessage({ status: true, result: res }))
			.catch(e => port.postMessage({ status: false, result: e }));
			break;
		}
		case "GetCommentAPI": {
			console.info(`OnMessageCallback: ${msg.APIName}を受け取りました。`);
			await GetCommentAPI.fetch(msg.APIObject.video_id)
			.then(res => port.postMessage({ status: true, result: res }))
			.catch(e => port.postMessage({ status: false, result: e }));
			break;
		}
		default:
			console.error(`OnMessageCallback: 未定義のAPI名"${msg.APIName}"を受け取りました。`);
			port.postMessage({ status: false, result: `API名"${msg.APIName}"は未定義です。` });
			break;
	}
	return true;
}

chrome.runtime.onConnect.addListener((port) => {
	/** @type {string} */
	const name = port.name;
	if (!name.startsWith("APIChannel")) return;
	port.onMessage.addListener(async (msg) => {
		await OnMessageCallback(port, msg);
		return true;
	});
});