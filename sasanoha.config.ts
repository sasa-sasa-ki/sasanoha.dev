/**
 * sasanoha.dev のCMS構成です。
 *
 * @remarks
 * @sasanoha/cms のnpm公開前は、consumer repository側の権威を
 * package依存なしで検証できるよう plain object で保持します。
 * 公開後は defineConfig(...) へ置換して型補完を有効化します。
 */
export default {
  language: "ja",
  name: "sasanoha.dev",

  deployment: {
    id: "sasanoha",
  },

  site: {
    url: "https://sasanoha.dev",
    previewUrl: "https://preview.sasanoha.dev",
  },

  admin: {
    path: "/admin",
    panel: {
      template: "default",
    },
    previewControls: "overlay",
  },

  items: {
    work: {
      label: "作品",
      description: "sasanoha.dev reference siteで扱う作品です。",
      properties: {
        image: {
          type: "image",
          label: "画像",
          required: true,
        },
        description: {
          type: "textarea",
          label: "作品の説明",
        },
        producedAt: {
          type: "date",
          label: "制作日時",
          required: true,
        },
      },
      defaultSort: {
        by: "producedAt",
        order: "desc",
      },
    },
  },
};
