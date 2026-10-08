"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { AdminHeader } from "@/app/admin/_components/AdminHeader";

type FaqRow = {
  id: string;
  category: string | null;
  question: string;
  answer: string;
  sort_order: number;
};

const EMPTY_FORM = {
  id: null as string | null,
  category: "",
  question: "",
  answer: "",
  sort_order: 0,
};

export default function FaqAdminPage() {
  const [supabase] = useState(() => createClient());
  const [faqList, setFaqList] = useState<FaqRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isEdit = form.id !== null;

  async function loadFaqList() {
    const { data, error } = await supabase
      .from("faq")
      .select("id, category, question, answer, sort_order")
      .order("sort_order", { ascending: true });

    if (error) {
      setLoadError("FAQの読み込みに失敗しました。");
      return;
    }
    setLoadError(null);
    setFaqList(data ?? []);
  }

  useEffect(() => {
    let active = true;
    supabase
      .from("faq")
      .select("id, category, question, answer, sort_order")
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setLoadError("FAQの読み込みに失敗しました。");
          return;
        }
        setLoadError(null);
        setFaqList(data ?? []);
      });
    return () => {
      active = false;
    };
  }, [supabase]);

  function startEdit(row: FaqRow) {
    setForm({
      id: row.id,
      category: row.category ?? "",
      question: row.question,
      answer: row.answer,
      sort_order: row.sort_order,
    });
    setFormError(null);
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    if (!form.question.trim() || !form.answer.trim()) {
      setFormError("質問と回答は必須です。");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const payload = {
      category: form.category.trim() || null,
      question: form.question.trim(),
      answer: form.answer.trim(),
      sort_order: form.sort_order,
    };

    const { error } = isEdit
      ? await supabase.from("faq").update(payload).eq("id", form.id as string)
      : await supabase.from("faq").insert(payload);

    setIsSubmitting(false);

    if (error) {
      setFormError("保存に失敗しました。もう一度お試しください。");
      return;
    }

    resetForm();
    await loadFaqList();
  }

  async function handleDelete(row: FaqRow) {
    const confirmed = window.confirm(
      `「${row.question}」を削除します。この操作は取り消せません。よろしいですか？`
    );
    if (!confirmed) return;

    setDeletingId(row.id);
    const { error } = await supabase.from("faq").delete().eq("id", row.id);
    setDeletingId(null);

    if (error) {
      window.alert("削除に失敗しました。もう一度お試しください。");
      return;
    }

    if (form.id === row.id) {
      resetForm();
    }
    await loadFaqList();
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 pb-10">
      <AdminHeader title="FAQ管理" backHref="/admin" />
      <div className="flex flex-col gap-4 px-4">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
        >
          <h2 className="text-base font-semibold text-zinc-900">
            {isEdit ? "FAQを編集" : "FAQを新規追加"}
          </h2>
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
            カテゴリ
            <input
              type="text"
              value={form.category}
              onChange={(event) =>
                setForm((f) => ({ ...f, category: event.target.value }))
              }
              placeholder="例：営業時間"
              className="h-12 min-h-[44px] rounded-lg border border-zinc-300 px-3 text-base"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
            質問
            <textarea
              required
              value={form.question}
              onChange={(event) =>
                setForm((f) => ({ ...f, question: event.target.value }))
              }
              rows={2}
              className="min-h-[44px] rounded-lg border border-zinc-300 px-3 py-2 text-base"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
            回答
            <textarea
              required
              value={form.answer}
              onChange={(event) =>
                setForm((f) => ({ ...f, answer: event.target.value }))
              }
              rows={4}
              className="min-h-[88px] rounded-lg border border-zinc-300 px-3 py-2 text-base"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
            表示順（小さいほど上に表示されます）
            <input
              type="number"
              value={form.sort_order}
              onChange={(event) =>
                setForm((f) => ({
                  ...f,
                  sort_order: Number(event.target.value) || 0,
                }))
              }
              className="h-12 min-h-[44px] rounded-lg border border-zinc-300 px-3 text-base"
            />
          </label>
          {formError && (
            <p className="text-sm font-medium text-red-600">{formError}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-12 min-h-[44px] flex-1 rounded-lg bg-zinc-900 text-base font-semibold text-white disabled:opacity-50"
            >
              {isSubmitting ? "保存中..." : isEdit ? "更新する" : "追加する"}
            </button>
            {isEdit && (
              <button
                type="button"
                onClick={resetForm}
                disabled={isSubmitting}
                className="h-12 min-h-[44px] rounded-lg border border-zinc-300 px-4 text-base font-medium text-zinc-700 disabled:opacity-50"
              >
                キャンセル
              </button>
            )}
          </div>
        </form>

        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-zinc-900">登録済みFAQ</h2>
          {loadError && (
            <p className="text-sm font-medium text-red-600">{loadError}</p>
          )}
          {faqList === null && !loadError && (
            <p className="text-sm text-zinc-500">読み込み中...</p>
          )}
          {faqList?.length === 0 && (
            <p className="text-sm text-zinc-500">まだFAQが登録されていません。</p>
          )}
          {faqList?.map((row) => (
            <div
              key={row.id}
              className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                  {row.category || "未分類"}
                </span>
                <span className="text-xs text-zinc-400">
                  表示順: {row.sort_order}
                </span>
              </div>
              <p className="text-sm font-semibold text-zinc-800">
                {row.question}
              </p>
              <p className="whitespace-pre-wrap text-sm text-zinc-600">
                {row.answer}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(row)}
                  className="h-11 min-h-[44px] flex-1 rounded-lg border border-zinc-300 text-sm font-medium text-zinc-700"
                >
                  編集
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(row)}
                  disabled={deletingId === row.id}
                  className="h-11 min-h-[44px] flex-1 rounded-lg border border-red-200 text-sm font-medium text-red-600 disabled:opacity-50"
                >
                  {deletingId === row.id ? "削除中..." : "削除"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
