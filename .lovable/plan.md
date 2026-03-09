

# Chat Intern / Mesagerie — Modul Beta

## Descriere
Sistem de mesagerie internă cu conversații directe (1-la-1) și grupuri pe departament, marcat ca **Beta v0.9** similar cu modulul de concedii.

## Structura bazei de date

**3 tabele noi:**

1. **`chat_conversations`** — conversațiile (direct sau grup)
   - `id`, `type` (direct/group), `name` (pentru grupuri), `department` (pentru grupuri auto), `created_by`, `created_at`, `updated_at`

2. **`chat_participants`** — cine participă la fiecare conversație
   - `id`, `conversation_id`, `user_id`, `joined_at`, `last_read_at`

3. **`chat_messages`** — mesajele propriu-zise
   - `id`, `conversation_id`, `sender_id`, `content` (text), `created_at`, `updated_at`, `is_edited`

Realtime activat pe `chat_messages` pentru primire instantanee.

## RLS (securitate)
- Participanții pot vedea/trimite mesaje doar în conversațiile la care participă
- Funcție `is_chat_participant(user_id, conversation_id)` SECURITY DEFINER pentru a evita recursivitate

## Funcționalități
1. **Conversații directe** — click pe un coleg din director/profil → deschide chat 1-la-1
2. **Grupuri departament** — create automat pe baza departamentului din `profiles`
3. **Indicatori necitite** — badge pe sidebar cu nr. mesaje necitite
4. **Typing indicator** — via Supabase Realtime Presence (fără tabel)
5. **Banner Beta** — controlat din `app_settings` (`chat_beta` key), identic cu cel de pe concedii

## Pagini și componente noi

- **`src/pages/Chat.tsx`** — pagina principală cu layout split (lista conversații + zona mesaje)
- **`src/components/chat/ConversationList.tsx`** — lista conversațiilor cu search, badge necitite
- **`src/components/chat/ChatWindow.tsx`** — zona de mesaje cu scroll infinit, input, timestamp-uri
- **`src/components/chat/NewConversationDialog.tsx`** — dialog pentru conversație nouă (selectare utilizator)
- **`src/components/chat/ChatBetaBanner.tsx`** — banner Beta reutilizabil

## Modificări existente
- **Sidebar.tsx** — adăugare link „Mesagerie" cu iconiță `MessageCircle` + badge necitite
- **App.tsx** — rută nouă `/chat`
- **app_settings** — inserare rând `chat_beta = true`

## Design UI
- Layout responsive: pe desktop split 30/70 (listă/mesaje), pe mobil navigare între ecrane
- Mesajele proprii aliniate la dreapta (albastru), cele primite la stânga (gri)
- Avatar + nume expeditor + timestamp
- ScrollArea pentru istoric mesaje
- Input cu buton Send în partea de jos

## Ordine implementare
1. Migrare DB (tabele + RLS + realtime)
2. Inserare setting `chat_beta`
3. Pagina Chat cu componentele
4. Integrare sidebar + routing
5. Badge necitite în sidebar

