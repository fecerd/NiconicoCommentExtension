/**
 * ニコニコ動画の検索API
 * @see https://site.nicovideo.jp/search-api-docs/snapshot
 */
export class SearchAPI {
  static fetch(word, limit = 10) {
    return fetch(`https://api.search.nicovideo.jp/api/v2/snapshot/video/contents/search?q=${encodeURIComponent(word)}%20-${encodeURIComponent('dアニメストア')}&targets=title,tagsExact&_sort=-commentCounter&fields=title,contentId,channelId,lengthSeconds,thumbnailUrl,commentCounter&_limit=${limit}&_context=CommentExtension`)
      .catch(error => {
        console.error(error);
        return Promise.reject('『スナップショット検索API v2』がエラーを返しました。');
      })
      .then(response => response.json());
  }
}
