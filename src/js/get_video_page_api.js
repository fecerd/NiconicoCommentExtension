export class GetVideoPageAPI {
	static fetch(id) {
		var url = "https://www.nicovideo.jp/watch/" + id;
		return fetch(url, { method :"GET" })
		.catch(error => {
			console.error(error);
			return Promise.reject('�w��������y�[�W�̓ǂݍ��݁x���G���[��Ԃ��܂����B');
		})
		.then(res => res.text());
	}
}