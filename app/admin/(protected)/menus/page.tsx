"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { AdminHeader } from "@/app/admin/_components/AdminHeader";

type MenuRow = {
  id: string;
  name: string;
  price: number;
  description: string | null;
  sort_order: number;
};

const EMPTY_FORM = {
  id: null as string | null,
  name: "",
  price: 0,
  description: "",
  sort_order: 0,
};

export default function MenusAdminPage() {
  const [supabase] = useState(() => createClient());
  const [menuList, setMenuList] = useState<MenuRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isEdit = form.id !== null;

  async function loadMenuList() {
    const { data, error } = await supabase
      .from("menus")
      .select("id, name, price, description, sort_order")
      .order("sort_order", { ascending: true });

    if (error) {
      setLoadError("メニューの読み込みに失敗しました。");
      return;
    }
    setLoadError(null);
    setMenuList(data ?? []);
  }

  useEffect(() => {
    let active = true;
    supabase
      .from("menus")
      .select("id, name, price, description, sort_order")
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setLoadError("メニューの読み込みに失敗しました。");
          return;
        }
        setLoadError(null);
        setMenuList(data ?? []);
      });
    return () => {
      active = false;
    };
  }, [supabase]);

  function startEdit(row: MenuRow) {
    setForm({
      id: row.id,
      name: row.name,
      price: row.price,
      description: row.description ?? "",
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

    if (!form.name.trim()) {
      setFormError("メニュー名は必須です。");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const payload = {
      name: form.name.trim(),
      price: form.price,
      description: form.description.trim() || null,
      sort_order: form.sort_order,
    };

    const { error } = isEdit
      ? await supabase.from("menus").update(payload).eq("id", form.id as string)
      : await supabase.from("menus").insert(payload);

    setIsSubmitting(false);

    if (error) {
      setFormError("保存に失敗しました。もう一度お試しください。");
      return;
    }

    resetForm();
    await loadMenuList();
  }

  async function handleDelete(row: MenuRow) {
    const confirmed = window.confirm(
      `「${row.name}」を削除します。この操作は取り消せません。よろしいですか？`
    );
    if (!confirmed) return;

    setDeletingId(row.id);
    const { error } = await supabase.from("menus").delete().eq("id", row.id);
    setDeletingId(null);

    if (error) {
      window.alert("削除に失敗しました。もう一度お試しください。");
      return;
    }

    if (form.id === row.id) {
      resetForm();
    }
    await loadMenuList();
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 pb-10">
      <AdminHeader title="メニューと料金" backHref="/admin" />
      <div className="flex flex-col gap-4 px-4">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
        >
          <h2 className="text-base font-semibold text-zinc-900">
            {isEdit ? "メニューを編集" : "メニューを新規追加"}
          </h2>
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
            メニュー名
            <input
              type="text"
              required
              value={form.name}
              onChange={(event) =>
                setForm((f) => ({ ...f, name: event.target.value }))
              }
              placeholder="例：カット"
              className="h-12 min-h-[44px] rounded-lg border border-zinc-300 px-3 text-base"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
            料金（円）
            <input
              type="number"
              min={0}
              value={form.price}
              onChange={(event) =>
                setForm((f) => ({
                  ...f,
                  price: Number(event.target.value) || 0,
                }))
              }
              className="h-12 min-h-[44px] rounded-lg border border-zinc-300 px-3 text-base"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
            説明
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((f) => ({ ...f, description: event.target.value }))
              }
              rows={3}
              className="min-h-[66px] rounded-lg border border-zinc-300 px-3 py-2 text-base"
              placeholder="例：シャンプー・ブロー込み"
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
          <h2 className="text-base font-semibold text-zinc-900">
            登録済みメニュー
          </h2>
          {loadError && (
            <p className="text-sm font-medium text-red-600">{loadError}</p>
          )}
          {menuList === null && !loadError && (
            <p className="text-sm text-zinc-500">読み込み中...</p>
          )}
          {menuList?.length === 0 && (
            <p className="text-sm text-zinc-500">
              まだメニューが登録されていません。
            </p>
          )}
          {menuList?.map((row) => (
            <div
              key={row.id}
              className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-zinc-800">
                  {row.name}
                </span>
                <span className="text-xs text-zinc-400">
                  表示順: {row.sort_order}
                </span>
              </div>
              <p className="text-base font-bold text-zinc-900">
                {row.price.toLocaleString("ja-JP")}円
              </p>
              {row.description && (
                <p className="whitespace-pre-wrap text-sm text-zinc-600">
                  {row.description}
                </p>
              )}
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
