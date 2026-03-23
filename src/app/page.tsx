export default function Home() {
  return (
    <>
      {/* 縦画面時の警告 */}
      <div className="portrait-warning fixed inset-0 z-50 flex items-center justify-center bg-gray-900 text-white text-xl">
        <div className="text-center p-8">
          <p className="text-4xl mb-4">📱</p>
          <p className="font-bold">横に回転してください</p>
          <p className="text-sm text-gray-400 mt-2">
            このアプリは横画面で使用します
          </p>
        </div>
      </div>

      {/* メインコンテンツ（横画面時のみ表示） */}
      <div className="main-content h-screen w-screen overflow-hidden flex-col bg-gray-100">
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-8">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">
              コンテナ荷降ろし管理
            </h1>
            <p className="text-gray-600">
              Excelファイルをアップロードして開始してください
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
