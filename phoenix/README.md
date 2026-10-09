# Phoenix persona pack

Phoenix is a portable personal-agent setup for the Phoenix edition of this fork.
The operating prompt adapts the reference prompt's structure and principles into
platform-independent guidance rather than reproducing its wording or host assumptions.
Everything here is a template; no personal history is included.

## Files

- `SOUL.md`: Phoenix's persona, also embedded in the installable package.
- `IDENTITY.md`: Phoenix's name and blank owner-selected character and vibe.
- `SYSTEM_PROMPT.md`: platform-independent operating guidance.
- `MEMORY_TEMPLATE.md`: blank Facts / Preferences / Commitments memory structure.
- `USER_TEMPLATE.md`: blank owner profile.
- `phoenix.botmrr.md`: native BotMRR v1 package with one agent, three playbooks,
  and a paused daily memory sweep.

## Install in OpenMausBot

1. Open **Templates → Import** and select `phoenix.botmrr.md` from this directory.
2. Review the preview and confirm installation. The package defines Phoenix as
   a Personal agent with the memory-keeping, due-diligence, and voice playbooks.
3. Place `SYSTEM_PROMPT.md` in the bot's workspace and add a short standing
   instruction to read and apply that file alongside the installed soul, within
   the host's higher-priority instructions and permissions. Use its explicit path
   and ensure file-reading tools are available. The full prompt exceeds the app's
   24,000-byte standing-instruction limit; do not paste it into that field.
   The v1 package does not automatically install the companion Markdown files.
   Reading a workspace file supplies guidance, not a higher-priority system message.
4. In the bot's private workspace, copy `IDENTITY.md`, copy `USER_TEMPLATE.md`
   as `USER.md`, and copy `MEMORY_TEMPLATE.md` as `MEMORY.md`. Make their location
   explicit in the bot's instructions and ensure the host can read and write them.
5. Fill the identity and user fields yourself. Start memory empty. Keep all
   personalized copies outside this repository and shared exports.
6. Review the memory-sweep routine's time and the app's scheduling timezone
   before enabling it. Its default is 21:00 every day; it starts disabled.
   Enable it only after private memory access is configured.

For other agent hosts, supply SOUL.md and SYSTEM_PROMPT.md as instructions and
configure access to the same private templates. If file persistence is unavailable,
Phoenix should propose updates for review and explain that they were not saved.

Installation does not grant file permissions, connect services, or import history.
The routine should use only the bot's authorized daily context and curated memory.

## License

All files in `phoenix/` are licensed under Apache-2.0 as part of the Phoenix
edition of this fork. See the repository's existing LICENSE and NOTICE for
license terms and attribution; those files remain intact.
