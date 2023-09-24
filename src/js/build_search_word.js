function buildSearchWord(title) {
	var tmp = title
	.replace('　', ' ') // 全角スペースは半角に直しておく
	.replace("ニコニコ動画", " ") //タイトルにニコニコ動画が入っている場合があるので消しておく
	.replace(/第(\d+)話/g, '$1') // 第◯話 の第はない場合もあるので消しておく(けもフレ対応)
	.replace(/[「」『』]/g, ' ') // 括弧も表記揺れがあるので消しておく(バカテス対応)
	.replace(/\(.*\)/, ' ') // (.*) も消して良いと思う(シュタゲ9,10話対応)
	.replace(/【.*】/, ' '); // 日テレオンデマンド対応
	// 特殊系
	tmp = tmp.replace('STEINS;GATE', 'シュタインズ ゲート ') // (シュタゲ対応)
	.replace(/ (\d+)駅/g, ' $1')  // (輪るピングドラム対応 (第N駅 <-> Nth station ・第は除去済み))
	.replace(/episode(\d+)/g, "");	//魔法科高校の劣等生 来訪者編対応

	// TODO: ゼロサプレスするとファンタシースターオンラインが死ぬので何か考えないとだめそう... (複数回検索するなど)
	var mode = -1;
	if (tmp.indexOf("フレームアームズ・ガール") != -1) mode = 1;
	else if (tmp.indexOf("お兄ちゃんはおしまい") != -1) mode = 1;
	switch (mode){
		case 1:	//#(＃)NNまでで検索する
			var index = tmp.indexOf("#");
			if (index == -1) index = tmp.indexOf("＃");
			if (index == -1) break;
			tmp = tmp.substring(0, index + 3);
			break;
		default:
			tmp = tmp.replace(/0+([0-9]+)/, "$1" ) // ゼロサプレス(とある魔術の禁書目録対応)
			.replace(/[#.\-"'<>]/g, ' '); // 記号系はスペースに変換しちゃっていいんじゃないかなあ。ダメなケースもあるかも(君に届け対応)
	}

	//虹ヶ咲学園スクールアイドル同好会2話対応
	if (tmp.indexOf("※") >= 0){
		if (tmp.indexOf("ラブライブ") >= 0){
			tmp = tmp.replace("◇", "?").substring(0, tmp.indexOf("※") - 1);
		}
	}
	return tmp;
}
