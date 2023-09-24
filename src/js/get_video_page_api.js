export class GetVideoPageAPI {
	static fetch(id) {
		var url = "https://www.nicovideo.jp/watch/" + id;
		return fetch(url, { method :"GET" })
		.catch(error => {
			console.error(error);
			return Promise.reject('『公式動画ページの読み込み』がエラーを返しました。');
		})
		.then(res => res.text());
	}
}