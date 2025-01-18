import './api_jsdoc.js'

export class SearchAPI {
	static _end_point = "https://snapshot.search.nicovideo.jp/api/v2/snapshot/video/contents/search";

	/**
	 * 指定した文字列で検索した結果を返す
	 * @param {string} word 検索文字列
	 * @param {number} limit 検索結果上限数
	 * @returns {Promise<SearchResultType>} 
	 */
	static async fetch(word, limit = 10) {
		const url = `${this._end_point}?q=${encodeURIComponent(word)}%20-${encodeURIComponent('dアニメストア')}&targets=title,tagsExact&_sort=-commentCounter&fields=title,contentId,channelId,lengthSeconds,thumbnailUrl,commentCounter&_limit=${limit}&_context=CommentExtension`;

		return fetch(url)
			.then(response => response.json());
	}
}