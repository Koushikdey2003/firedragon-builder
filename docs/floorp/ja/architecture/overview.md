# Floorp ブラウザ - アーキテクチャ概要

## プロジェクト概要

Floorp は、Mozilla Firefox をベースとした独立したブラウザで、オープンでプライベートで持続可能な Web を維持するために設計されています。Firefox の安定性とセキュリティを維持しながら、独自の機能と改善されたユーザー体験を提供します。

## 設計哲学

### 1. Firefox 互換性の維持

- Firefox のコアエンジン（Gecko）をそのまま使用
- Firefox の更新に追随できるアーキテクチャ
- 既存の Firefox 拡張機能との互換性

### 2. モジュラー設計

- 各機能の独立したアプリケーション
- 再利用可能なパッケージシステム
- プラグ可能なテーマシステム

### 3. モダンな開発体験

- TypeScript による型安全性
- SolidJS による高性能 UI
- ホットリロード対応の開発環境

### 4. マルチプラットフォーム対応

- Windows、macOS、Linux 間での統一された体験
- プラットフォーム固有の最適化

## 全体アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                    Floorpブラウザ                           │
├─────────────────────────────────────────────────────────────┤
│  UIアプリケーション (SolidJS + TypeScript)                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐   │
│  │  メイン │ │設定     │ │新規タブ │ │ その他のアプリ   │   │
│  │  アプリ │ │  アプリ │ │  アプリ │ │ (メモ等)        │   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  共有パッケージ & ライブラリ                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │ Solid-XUL   │ │ スキン      │ │ ユーザースクリプト  │   │
│  │             │ │ システム    │ │ ランナー            │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  Firefox/Geckoエンジン                                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │ Geckoコア   │ │ XUL/XPCOM   │ │ WebExtensions API   │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 主要コンポーネント

### 1. UI アプリケーション層

**技術**: SolidJS + TypeScript + Tailwind CSS

- **メインアプリケーション**: 主要なブラウザ機能と UI
- **設定アプリケーション**: ユーザー設定とカスタマイズ
- **新規タブ**: カスタマイズ可能なスタートページ
- **その他**: メモ、ウェルカム画面、モーダルダイアログ

### 2. 共有パッケージ層

**技術**: TypeScript + モジュラー設計

- **Solid-XUL**: SolidJS と Firefox XUL の統合
- **スキンシステム**: テーマとスタイリング管理
- **ユーザースクリプトランナー**: カスタムスクリプト実行
- **テストユーティリティ**: テストサポートツール

### 3. Firefox/Gecko 統合層

**技術**: C++ + JavaScript + XUL

- **Gecko エンジン**: Firefox のブラウザエンジン
- **XUL/XPCOM**: Firefox の UI フレームワーク
- **WebExtensions**: ブラウザ拡張機能 API

## データフロー

### 1. 開発データフロー

```
開発者コード変更
    ↓
Denoビルドシステム
    ↓
TypeScriptコンパイル + SolidJS変換
    ↓
Firefoxバイナリへのコード注入
    ↓
カスタマイズされたFirefoxの起動
```

### 2. ランタイムデータフロー

```
ユーザー操作
    ↓
SolidJSアプリケーション
    ↓
Solid-XULブリッジ
    ↓
Firefox XULシステム
    ↓
Geckoエンジン
    ↓
Webページ表示 & インタラクション
```
