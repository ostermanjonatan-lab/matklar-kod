import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  Check,
  Copy,
  CheckCircle2,
  Code
} from 'lucide-react';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
} from '../../services/supabaseClient';

interface SupabaseConfigModalProps {
  onClose: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({ onClose }) => {
  const currentConfig = getSupabaseConfig();
  const [url, setUrl] = useState<string>(currentConfig.url);
  const [anonKey, setAnonKey] = useState<string>(currentConfig.anonKey);
  const [savedToast, setSavedToast] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  useEffect(() => {
    setUrl(currentConfig.url);
    setAnonKey(currentConfig.anonKey);
  }, [currentConfig.url, currentConfig.anonKey]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseConfig(url.trim(), anonKey.trim());
    setSavedToast(true);
    setTimeout(() => {
      setSavedToast(false);
      window.location.reload();
    }, 1200);
  };

  const handleCopySql = () => {
    const sqlSchema = `-- Supabase Schema för Matklar
create table if not exists households (
  id text primary key,
  name text not null,
  join_code text not null unique,
  creator_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table households add column if not exists creator_id text;

create table if not exists profiles (
  id text primary key,
  household_id text references households(id) on delete cascade,
  display_name text not null,
  initials text not null,
  role_title text default 'Medlem',
  email text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists household_join_requests (
  id text primary key,
  household_id text references households(id) on delete cascade,
  user_id text not null,
  display_name text not null,
  status text default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists recipes (
  id text primary key,
  household_id text references households(id) on delete cascade,
  title text not null,
  description text default '',
  cover_image_url text not null,
  recipe_document_url text,
  source_url text,
  source_type text default 'manual',
  servings integer default 4,
  category text default 'Middag',
  subcategory text default '',
  rating integer default 5,
  is_favorite boolean default false,
  notes text default '',
  ingredients jsonb default '[]'::jsonb,
  instructions jsonb default '[]'::jsonb,
  prep_time_minutes integer,
  cook_time_minutes integer,
  tags text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists meal_plans (
  id text primary key,
  household_id text references households(id) on delete cascade,
  day_name text not null,
  lunch_recipe_id text,
  lunch_servings integer default 2,
  dinner_recipe_id text,
  dinner_servings integer default 4,
  custom_lunch text,
  custom_dinner text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists shopping_items (
  id text primary key,
  household_id text references households(id) on delete cascade,
  name text not null,
  amount numeric,
  unit text default 'st',
  aisle text default 'Övrigt',
  is_pantry_staple boolean default false,
  checked boolean default false,
  recipe_source text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter publication supabase_realtime add table recipes;
alter publication supabase_realtime add table meal_plans;
alter publication supabase_realtime add table shopping_items;
`;
    navigator.clipboard.writeText(sqlSchema);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in font-sans">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-stone-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-stone-800 border border-stone-700 text-emerald-400 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Backend & Databas</h3>
              <p className="text-xs text-stone-400">Molndatabas & Realtidssynk</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 rounded-2xl bg-stone-800 text-stone-300 hover:text-white flex items-center justify-center touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Toast */}
        {savedToast && (
          <div className="bg-stone-900 text-white px-4 py-3 text-xs font-semibold flex items-center gap-2 animate-fade-in border-b border-stone-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Inställningar sparade. Laddar om...</span>
          </div>
        )}

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Status Indicator */}
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-2 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-stone-700">Aktuellt synkläge:</span>
              {currentConfig.isConfigured ? (
                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 font-semibold px-2.5 py-1 rounded-lg text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Molnsynk Aktiv
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-stone-200 text-stone-800 font-semibold px-2.5 py-1 rounded-lg text-[11px]">
                  Lokal Realtid (Multi-tab)
                </span>
              )}
            </div>

            <p className="text-stone-500 leading-relaxed text-xs">
              Appen stöder både blixtsnabb lokal realtidssynk mellan enheter och central molnsynk.
            </p>
          </div>

          {/* Cloud Database Connection Form */}
          <form onSubmit={handleSave} className="space-y-3.5">
            <h4 className="font-bold text-stone-900 text-xs">Koppla molndatabas</h4>

            <div>
              <label className="font-semibold text-stone-600 block mb-1">
                Project URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://xyzcompany.supabase.co"
                className="w-full h-11 bg-stone-50 border border-stone-300 rounded-xl px-3.5 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 font-mono"
              />
            </div>

            <div>
              <label className="font-semibold text-stone-600 block mb-1">
                Anon / Public API Key
              </label>
              <input
                type="password"
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full h-11 bg-stone-50 border border-stone-300 rounded-xl px-3.5 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 font-mono"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => {
                  setUrl('');
                  setAnonKey('');
                  saveSupabaseConfig('', '');
                  setSavedToast(true);
                  setTimeout(() => window.location.reload(), 1000);
                }}
                className="text-stone-500 hover:text-rose-600 text-xs py-2 touch-manipulation"
              >
                Rensa konfiguration
              </button>

              <button
                type="submit"
                className="px-5 py-2.5 bg-stone-900 hover:bg-black text-white font-semibold text-xs rounded-xl active:scale-95 shadow-xs touch-manipulation min-h-[46px]"
              >
                Spara & Anslut
              </button>
            </div>
          </form>

          {/* SQL Migration Script helper */}
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-stone-800 text-xs">
                <Code className="w-4 h-4 text-stone-700" />
                <span>SQL-Schema för databasen</span>
              </div>

              <button
                type="button"
                onClick={handleCopySql}
                className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-[11px] font-semibold text-stone-800 hover:bg-stone-100 flex items-center gap-1 touch-manipulation min-h-[38px]"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSql ? 'Kopierat' : 'Kopiera SQL'}</span>
              </button>
            </div>

            <p className="text-[11px] text-stone-500 leading-relaxed">
              Kopiera och klistra in i SQL Editor för att skapa tabellerna och realtidsreplikeringen automatiskt.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-4 bg-stone-900 hover:bg-black active:scale-95 text-white font-semibold text-xs rounded-xl touch-manipulation min-h-[52px]"
          >
            Stäng
          </button>
        </div>
      </div>
    </div>
  );
};
