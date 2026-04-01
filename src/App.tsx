import { useEffect, useMemo, useRef, useState } from "react";
import EditorJS, { type OutputData } from "@editorjs/editorjs";
import Embed from "@editorjs/embed";
import Header from "@editorjs/header";
import List from "@editorjs/list";
import MediaLayoutTool from "./components/editor/MediaLayoutBlockTool";
import TextColorInlineTool, {
  HighlightInlineTool,
} from "./components/editor/TextColorInlineTool";
import "./components/editor/media-layout-tool.css";
import { PreviewBlocks } from "./components/preview/PreviewBlocks";
import { PreviewMedia } from "./components/preview/PreviewMedia";
import { initialContent } from "./lib/constants";
import {
  clearPersistedState,
  loadPersistedState,
  persistState,
} from "./lib/storage";
import type { PersistedState } from "./types/blog";
import macbookContainer from "./assets/macbook-container.png";

type AppView = "editor" | "preview";

class YouTubeEmbedTool extends Embed {
  static get toolbox() {
    return {
      title: "YouTube",
      icon: `<svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M21.8 8.001a2.75 2.75 0 0 0-1.94-1.945C18.14 5.6 12 5.6 12 5.6s-6.14 0-7.86.456A2.75 2.75 0 0 0 2.2 8.001 28.27 28.27 0 0 0 1.75 12c0 1.35.15 2.686.45 3.999a2.75 2.75 0 0 0 1.94 1.945C5.86 18.4 12 18.4 12 18.4s6.14 0 7.86-.456a2.75 2.75 0 0 0 1.94-1.945c.3-1.313.45-2.649.45-3.999 0-1.35-.15-2.686-.45-3.999ZM10.1 14.9V9.1L15.2 12l-5.1 2.9Z"/></svg>`,
    };
  }

  render() {
    const element = super.render();
    const caption = element.querySelector(".embed-tool__caption");
    caption?.remove();
    return element;
  }

  save(block: HTMLElement) {
    const data = super.save(block) as {
      service: string;
      source: string;
      embed: string;
      width?: number;
      height?: number;
      caption?: string;
    };

    return {
      ...data,
      caption: "",
    };
  }
}

const safelyDestroyEditor = (instance: EditorJS | null) => {
  if (!instance) {
    return;
  }

  const maybeDestroy = instance.destroy;
  if (typeof maybeDestroy !== "function") {
    return;
  }

  try {
    maybeDestroy.call(instance);
  } catch {
    // EditorJS can already be torn down or be in an incomplete init state.
  }
};

const getViewFromHash = (): AppView =>
  window.location.hash === "#preview" ? "preview" : "editor";

const installNotionPlusBehavior = (
  editor: EditorJS,
  holder: HTMLDivElement,
) => {
  let lastHandledAt = 0;

  const handleToolbarClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const plusButton = target.closest(".ce-toolbar__plus");
    if (!plusButton) {
      return;
    }

    const now = performance.now();
    if (now - lastHandledAt < 200) {
      return;
    }

    lastHandledAt = now;

    window.setTimeout(() => {
      const currentIndex = editor.blocks.getCurrentBlockIndex();
      if (currentIndex < 0) {
        return;
      }

      const nextIndex = currentIndex + 1;
      editor.blocks.insert("paragraph", {}, undefined, nextIndex, true, false);

      requestAnimationFrame(() => {
        editor.caret.setToBlock(nextIndex, "start");
      });
    }, 0);
  };

  holder.addEventListener("click", handleToolbarClick);

  return () => {
    holder.removeEventListener("click", handleToolbarClick);
  };
};

function App() {
  const persisted = useMemo(() => loadPersistedState(), []);
  const initialEditorData = persisted?.content ?? initialContent;
  const editorRef = useRef<EditorJS | null>(null);
  const holderRef = useRef<HTMLDivElement | null>(null);
  const [content, setContent] = useState<OutputData>(initialEditorData);
  const latestContentRef = useRef<OutputData>(initialEditorData);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [submitPreviewOpen, setSubmitPreviewOpen] = useState(false);
  const [submitPayload, setSubmitPayload] = useState<string>("");
  const [view, setView] = useState<AppView>(() => getViewFromHash());

  useEffect(() => {
    latestContentRef.current = content;
  }, [content]);

  useEffect(() => {
    const syncView = () => {
      setView(getViewFromHash());
    };

    window.addEventListener("hashchange", syncView);
    return () => {
      window.removeEventListener("hashchange", syncView);
    };
  }, []);

  useEffect(() => {
    if (view !== "editor" || !holderRef.current) {
      return;
    }

    let detached = false;
    let activeEditor: EditorJS | null = null;
    let cleanupPlusBehavior: (() => void) | null = null;

    const createEditor = (data: OutputData) => {
      holderRef.current!.innerHTML = "";
      return new EditorJS({
        holder: holderRef.current!,
        data,
        autofocus: true,
        tools: {
          header: Header as unknown as EditorJS.ToolConstructable,
          list: List as unknown as EditorJS.ToolConstructable,
          textColor: TextColorInlineTool as unknown as EditorJS.ToolConstructable,
          highlight: HighlightInlineTool as unknown as EditorJS.ToolConstructable,
          youtube: {
            class: YouTubeEmbedTool as unknown as EditorJS.ToolConstructable,
            config: {
              services: {
                youtube: true,
              },
            },
          },
          mediaLayout: {
            class: MediaLayoutTool as unknown as EditorJS.ToolConstructable,
          },
        },
        onChange: async () => {
          if (!activeEditor) return;
          const nextData = await activeEditor.save();
          setContent(nextData);
        },
      });
    };

    const mountEditor = async (data: OutputData, allowRecovery: boolean) => {
      try {
        const editor = createEditor(data);
        activeEditor = editor;
        await editor.isReady;
        if (detached) {
          safelyDestroyEditor(editor);
          return;
        }
        setEditorError(null);
        editorRef.current = editor;
        cleanupPlusBehavior = installNotionPlusBehavior(
          editor,
          holderRef.current!,
        );
      } catch {
        safelyDestroyEditor(activeEditor);
        activeEditor = null;
        editorRef.current = null;

        if (allowRecovery) {
          clearPersistedState();
          setContent(initialContent);
          await mountEditor(initialContent, false);
          return;
        }

        queueMicrotask(() => {
          setEditorError(
            "Khoi tao editor that bai. Anh thu tai lai trang nhe.",
          );
        });
      }
    };

    void mountEditor(latestContentRef.current, true);

    return () => {
      detached = true;
      cleanupPlusBehavior?.();
      safelyDestroyEditor(activeEditor);
      editorRef.current = null;
    };
  }, [view]);

  useEffect(() => {
    const snapshot: PersistedState = {
      content,
    };

    const warning = persistState(snapshot);
    if (warning) {
      console.warn(warning);
    }
  }, [content]);

  const syncLiveContent = async () => {
    const liveContent = editorRef.current
      ? await editorRef.current.save()
      : content;
    setContent(liveContent);
    latestContentRef.current = liveContent;
    return liveContent;
  };

  const navigateTo = async (nextView: AppView) => {
    await syncLiveContent();
    const nextHash = nextView === "preview" ? "#preview" : "#editor";
    if (window.location.hash === nextHash) {
      setView(nextView);
      return;
    }
    window.location.hash = nextHash;
  };

  const handleSubmitPreview = async () => {
    const liveContent = await syncLiveContent();
    setContent(liveContent);
    setSubmitPayload(
      JSON.stringify(
        {
          content: liveContent,
        },
        null,
        2,
      ),
    );
    setSubmitPreviewOpen(true);
  };

  const previewFrame = (
    <div className="relative mx-auto inline-block h-full max-w-full aspect-[3296/1894]">
      <img
        src={macbookContainer}
        alt="MacBook preview frame"
        className="pointer-events-none block h-full w-auto max-w-full select-none"
      />

      <div className="macbook-preview-screen absolute bg-black">
        <div className="macbook-browser-shell flex h-full flex-col overflow-hidden bg-white text-slate-900">
          <div className="macbook-preview-scroll min-h-0 flex-1 overflow-y-auto bg-white">
            <div className="border-b border-slate-200 bg-[#fafafa] px-[clamp(12px,1vw,18px)] py-[clamp(3px,0.28vw,5px)]">
              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-[clamp(16px,1.8vw,30px)] text-[#2f7cff]">
                <div className="flex items-center gap-[clamp(20px,2.4vw,42px)]">
                  <svg
                    viewBox="0 0 31 55"
                    className="h-[clamp(18px,1.1vw,24px)] w-[clamp(10px,0.6vw,14px)]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M28.3144 2.5354L3.53595 27.021M28.4655 52.0619L3.0625 27.5349" />
                  </svg>
                  <svg
                    viewBox="0 0 31 55"
                    className="h-[clamp(18px,1.1vw,24px)] w-[clamp(10px,0.6vw,14px)] text-slate-300"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M2.68623 52.4645L27.4647 27.979M2.53516 2.93799L27.9381 27.465" />
                  </svg>
                  <svg
                    viewBox="0 0 70 60"
                    className="h-[clamp(22px,1.35vw,28px)] w-[clamp(22px,1.35vw,28px)]"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M32.2931 61C31.7327 60.3476 31.0631 59.7201 30.2817 59.1293C27.4234 56.9682 23.2728 55.5 18.5 55.5C13.7272 55.5 9.5766 56.9682 6.7183 59.1293C5.93693 59.7201 5.26734 60.3476 4.70686 61H0V8.81399C3.30175 3.60059 10.3448 0 18.5 0C25.266 0 31.2665 2.47839 35 6.29998C38.7335 2.47839 44.734 0 51.5 0C60.094 0 67.4529 3.99843 70.5 9.66911V61H65.2931C64.7327 60.3476 64.0631 59.7201 63.2817 59.1293C60.4234 56.9682 56.2728 55.5 51.5 55.5C46.7272 55.5 42.5766 56.9682 39.7183 59.1293C38.9369 59.7201 38.2673 60.3476 37.7069 61H32.2931ZM37.5 10.248V55.1774C41.1642 52.5862 46.0871 51 51.5 51C57.1631 51 62.2899 52.7362 66 55.5431V10.9184C65.3272 9.93494 64.4239 8.9929 63.2817 8.12931C60.4234 5.96815 56.2728 4.5 51.5 4.5C46.7272 4.5 42.5766 5.96815 39.7183 8.12931C38.8384 8.79462 38.1002 9.50648 37.5 10.248ZM33 55.5431C29.2899 52.7362 24.1631 51 18.5 51C13.0871 51 8.1642 52.5862 4.5 55.1774V10.248C5.10022 9.50648 5.83838 8.79462 6.7183 8.12931C9.5766 5.96815 13.7272 4.5 18.5 4.5C23.2728 4.5 27.4234 5.96815 30.2817 8.12931C31.4239 8.9929 32.3272 9.93494 33 10.9184V55.5431Z"
                    />
                  </svg>
                </div>

                <div className="relative mx-auto flex w-full max-w-[clamp(260px,43vw,560px)] items-center justify-between rounded-[clamp(12px,1vw,16px)] bg-[#ececef] px-[clamp(14px,1.2vw,20px)] py-[clamp(5px,0.42vw,8px)] text-slate-900">
                  <div className="relative z-10 flex items-center">
                    <span className="text-[clamp(12px,0.86vw,16px)] font-medium tracking-[-0.01em] text-slate-800">
                      AA
                    </span>
                  </div>

                  <div className="pointer-events-none absolute inset-y-0 left-1/2 flex -translate-x-1/2 items-center">
                    <div className="flex min-w-0 items-center gap-[clamp(7px,0.55vw,10px)] text-[clamp(12px,0.98vw,17px)] font-medium text-slate-900">
                      <svg
                        viewBox="0 0 16 23"
                        className="h-[clamp(13px,0.9vw,16px)] w-[clamp(9px,0.6vw,12px)] shrink-0"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          clipRule="evenodd"
                          d="M2 6C2 2.68629 4.68629 0 8 0C11.3137 0 14 2.68629 14 6V10C15.1046 10 16 10.8954 16 12V21C16 22.1046 15.1046 23 14 23H2C0.895431 23 0 22.1046 0 21V12C0 10.8954 0.895431 10 2 10V6ZM11.5 6C11.5 4.067 9.933 2.5 8 2.5C6.067 2.5 4.5 4.067 4.5 6V10H11.5V6Z"
                        />
                      </svg>
                      <span className="whitespace-nowrap">
                        blog-preview.local
                      </span>
                    </div>
                  </div>

                  <svg
                    viewBox="0 0 25 31"
                    className="relative z-10 h-[clamp(18px,1.05vw,22px)] w-[clamp(15px,0.9vw,19px)] shrink-0 text-slate-900"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M18.1868 7.33683C18.16 7.36365 18.1322 7.38887 18.1035 7.41249C18.0531 7.5023 17.9897 7.58678 17.9133 7.66319L12.5396 13.0368C12.0905 13.4859 11.3624 13.4859 10.9133 13.0368C10.4642 12.5877 10.4642 11.8596 10.9133 11.4105L14.5001 7.82364H12.15C12.0992 7.82364 12.0491 7.82034 12 7.81395V7.83569C6.59894 8.0964 2.3 12.558 2.3 18.0237C2.3 23.657 6.8667 28.2237 12.5 28.2237C17.9657 28.2237 22.4273 23.9247 22.688 18.5237H22.7V18.3737C22.7 17.7385 23.2149 17.2237 23.85 17.2237C24.4851 17.2237 25 17.7385 25 18.3737V18.6737C25 18.7697 24.9882 18.863 24.966 18.9522C24.4909 25.4221 19.0912 30.5237 12.5 30.5237C5.59644 30.5237 0 24.9272 0 18.0237C0 11.2881 5.32745 5.79674 11.9985 5.53353C12.0481 5.52701 12.0986 5.52364 12.15 5.52364H14.7473L11.1868 1.96317C10.7377 1.51407 10.7377 0.78593 11.1868 0.336827C11.6359 -0.112276 12.3641 -0.112276 12.8132 0.336827L18.1868 5.71048C18.6359 6.15958 18.6359 6.88772 18.1868 7.33683Z"
                    />
                  </svg>
                </div>

                <div className="flex items-center gap-[clamp(22px,2.5vw,40px)]">
                  <svg
                    viewBox="0 0 56 73"
                    className="h-[clamp(21px,1.2vw,26px)] w-[clamp(16px,0.95vw,22px)]"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M15.591 11.8068C14.7123 12.6855 14.7123 14.1101 15.591 14.9888C16.4697 15.8675 17.8943 15.8675 18.773 14.9888L26 7.76178V45.1971C26 46.4398 27.0074 47.4471 28.25 47.4471C29.4926 47.4471 30.5 46.4398 30.5 45.1971V7.48272L37.7832 14.7659C38.6619 15.6446 40.0865 15.6446 40.9652 14.7659C41.8439 13.8873 41.8439 12.4626 40.9652 11.584L30.1965 0.815221C30.0099 0.62864 29.7987 0.481678 29.5733 0.374336C28.6995 -0.206342 27.5093 -0.11145 26.7388 0.65901L15.591 11.8068Z" />
                    <path d="M8 20.4471H19V24.9471H8C6.067 24.9471 4.5 26.5141 4.5 28.4471V64.4471C4.5 66.3801 6.067 67.9471 8 67.9471H48C49.933 67.9471 51.5 66.3801 51.5 64.4471V28.4471C51.5 26.5141 49.933 24.9471 48 24.9471H38V20.4471H48C52.4183 20.4471 56 24.0289 56 28.4471V64.4471C56 68.8654 52.4183 72.4471 48 72.4471H8C3.58172 72.4471 0 68.8654 0 64.4471V28.4471C0 24.0289 3.58172 20.4471 8 20.4471Z" />
                  </svg>
                  <svg
                    viewBox="0 0 59 59"
                    className="h-[clamp(18px,1.1vw,24px)] w-[clamp(18px,1.1vw,24px)]"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M31.5 2.25C31.5 1.00736 30.4926 0 29.25 0C28.0074 0 27 1.00736 27 2.25V27L2.25 27C1.00736 27 0 28.0074 0 29.25C0 30.4926 1.00736 31.5 2.25 31.5L27 31.5V56.25C27 57.4926 28.0074 58.5 29.25 58.5C30.4926 58.5 31.5 57.4926 31.5 56.25V31.5L56.25 31.5C57.4926 31.5 58.5 30.4926 58.5 29.25C58.5 28.0074 57.4926 27 56.25 27L31.5 27V2.25Z" />
                  </svg>
                  <svg
                    viewBox="0 0 67 66"
                    className="h-[clamp(22px,1.25vw,28px)] w-[clamp(22px,1.25vw,28px)]"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M52 14H59C63.4183 14 67 17.5817 67 22V58C67 62.4183 63.4183 66 59 66H23C18.5817 66 15 62.4183 15 58V52H8C3.58172 52 0 48.4183 0 44V8C0 3.58172 3.58172 0 8 0H44C48.4183 0 52 3.58172 52 8V14ZM44 4.5H8C6.067 4.5 4.5 6.067 4.5 8V44C4.5 45.933 6.067 47.5 8 47.5H15V22C15 17.5817 18.5817 14 23 14H47.5V8C47.5 6.067 45.933 4.5 44 4.5ZM23 18.5H59C60.933 18.5 62.5 20.067 62.5 22V58C62.5 59.933 60.933 61.5 59 61.5H23C21.067 61.5 19.5 59.933 19.5 58V22C19.5 20.067 21.067 18.5 23 18.5Z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <article className="mx-auto w-full max-w-[920px] px-[clamp(18px,2.4vw,44px)] py-[clamp(18px,2.1vw,36px)]">
              <PreviewBlocks
                content={content}
                renderMediaLayout={(data, blockId) => (
                  <div key={blockId} className="not-prose my-8">
                    <PreviewMedia media={data.items} layout={data.layout} />
                  </div>
                )}
              />
            </article>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_24%),linear-gradient(180deg,#fffdf8_0%,#eef4ff_100%)] text-slate-900">
      {view === "editor" ? (
        <div className="mx-auto min-h-screen w-full max-w-[1880px] px-4 py-6 xl:px-8 2xl:max-w-[2040px] 2xl:px-10">
          <section className="rounded-[32px] border border-white/70 bg-white/82 p-5 shadow-[0_28px_90px_rgba(15,23,42,0.10)] backdrop-blur xl:p-7">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-amber-600">
                  Editor Workspace
                </p>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                  Blog Content Builder
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void navigateTo("preview")}
                  className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-[0_12px_32px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => void handleSubmitPreview()}
                  className="rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(249,115,22,0.28)] transition hover:-translate-y-0.5 hover:bg-orange-600"
                >
                  Submit
                </button>
              </div>
            </div>

            {editorError ? (
              <p className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {editorError}
              </p>
            ) : null}

            <div className="rounded-[28px] border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-3 shadow-inner shadow-slate-200/60 sm:p-4 lg:p-5">
              <div ref={holderRef} className="editor-canvas min-h-[70vh]" />
            </div>
          </section>
        </div>
      ) : (
        <div className="mx-auto flex h-screen w-full max-w-[2200px] flex-col overflow-hidden px-4 py-6 xl:px-8 2xl:px-10">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">
                Preview Page
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                MacBook Preview
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void navigateTo("editor")}
                className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-[0_12px_32px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
              >
                Back To Editor
              </button>
              <button
                type="button"
                onClick={() => void handleSubmitPreview()}
                className="rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(249,115,22,0.28)] transition hover:-translate-y-0.5 hover:bg-orange-600"
              >
                Submit
              </button>
            </div>
          </div>

          <section className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[36px] border border-white/70 bg-white/72 px-4 py-6 shadow-[0_28px_90px_rgba(15,23,42,0.10)] backdrop-blur md:px-6 xl:px-8">
            {previewFrame}
          </section>
        </div>
      )}

      {submitPreviewOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-[28px] border border-white/70 bg-white p-5 shadow-[0_28px_80px_rgba(15,23,42,0.28)] sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-600">
                  Submit Payload
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  Body gui len backend
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Payload nay chi gom du lieu editor, khong kem tieu de hay
                  metadata khac.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSubmitPreviewOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-2xl leading-none text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
              >
                ×
              </button>
            </div>

            <pre className="max-h-[65vh] overflow-auto rounded-[24px] bg-slate-950 p-4 text-sm leading-7 text-slate-100">
              <code>{submitPayload}</code>
            </pre>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default App;
