/** Controlador administrativo: eventos, validações e operações de configuração. */
import {timezones} from "./settings.view.js";
/** Vincula os formulários ao contexto atual, sem produzir HTML. */
export function bindSettingsEvents({host,state,supabase,toast,reportError,canManageSettings,reload}){
    if (host.dataset.bound !== "true") {
      host.dataset.bound = "true";
      const active=()=>host.isConnected&&host._settingsContext?.context===JSON.stringify([state.organization?.id,state.user?.id,state.membership?.role]);

      host.addEventListener("click", event => {
        const opener = event.target.closest("[data-open-settings]");
        if (opener) {
          if(!active())return;
          if (!canManageSettings()) return toast("Seu perfil tem acesso somente para consulta.");
          const dialog = document.querySelector(opener.dataset.openSettings === "organization"
            ? "#settings-organization-modal" : "#settings-branch-modal");
          if (dialog && !dialog.open) dialog.showModal();
          return;
        }
        if (event.target.closest("[data-close-settings]")) {
          host.querySelectorAll("dialog[open]").forEach(dialog => dialog.close());
        }
      });

      host.addEventListener("change", event => {
        if (event.target.id !== "settings-branch-select") return;
        if(!active())return;
        state.branch = host._settingsContext.units.find(unit => unit.id === event.target.value) || null;
        reload();
      });

      host.addEventListener("submit", async event => {
        if(!active())return;
        const orgId=host._settingsContext.orgId,units=host._settingsContext.units;
        const form = event.target;
        if (!form.matches("#public-profile-form")) return;
        event.preventDefault();
        if (!canManageSettings()) return toast("Somente proprietário ou administrador pode publicar o salão.");
        const values = new FormData(form);
        const slug = String(values.get("slug") || "").trim().toLowerCase();
        const displayName = String(values.get("display_name") || "").trim();
        const city = String(values.get("city") || "").trim();
        const stateCode = String(values.get("state") || "").trim().toUpperCase();
        const latitudeText = String(values.get("latitude") || "").trim();
        const longitudeText = String(values.get("longitude") || "").trim();
        const latitude = latitudeText ? Number(latitudeText) : null;
        const longitude = longitudeText ? Number(longitudeText) : null;
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return toast("O endereço público deve usar letras minúsculas, números e hífens.");
        if (displayName.length < 2) return toast("Informe o nome público do salão.");
        if (city.length < 2 || !/^[A-Z]{2}$/.test(stateCode)) return toast("Informe cidade e UF válidas.");
        if ((latitude === null) !== (longitude === null) ||
            (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
             !Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {
          return toast("Informe latitude e longitude válidas juntas, ou deixe ambas vazias.");
        }
        for (const field of ["logo_url","cover_image_url","website_url","instagram_url"]) {
          const value = String(values.get(field) || "").trim();
          if (value && !value.startsWith("https://")) return toast("Todos os links públicos devem começar com https://.");
        }
        const submit = form.querySelector('[type="submit"]');
        if(!submit||submit.disabled)return;
        submit.disabled = true;
        try {
          const { data, error } = await supabase.rpc("save_public_salon_profile", {
            p_org_id: orgId,
            p_branch_id: form.dataset.branchId,
            p_slug: slug,
            p_display_name: displayName,
            p_description: String(values.get("description") || "").trim() || null,
            p_logo_url: String(values.get("logo_url") || "").trim() || null,
            p_cover_image_url: String(values.get("cover_image_url") || "").trim() || null,
            p_public_phone: String(values.get("public_phone") || "").trim() || null,
            p_website_url: String(values.get("website_url") || "").trim() || null,
            p_instagram_url: String(values.get("instagram_url") || "").trim() || null,
            p_is_published: values.get("is_published") === "on",
            p_public_address: String(values.get("public_address") || "").trim() || null,
            p_neighborhood: String(values.get("neighborhood") || "").trim() || null,
            p_city: city,
            p_state: stateCode,
            p_postal_code: String(values.get("postal_code") || "").trim() || null,
            p_latitude: latitude,
            p_longitude: longitude,
            p_branch_public_phone: String(values.get("branch_public_phone") || "").trim() || null,
            p_branch_is_published: values.get("branch_is_published") === "on"
          });
          if (error) throw error;
          if (data !== true) throw new Error("A vitrine não foi salva. Confira as permissões e tente novamente.");
          if(!active())return;
          toast("Vitrine pública atualizada.");
          await reload();
        } catch (error) {
          reportError(error, { context: "Configurações > salvar vitrine pública" });
        } finally {
          if (submit.isConnected) submit.disabled = false;
        }
      });

      host.addEventListener("submit", async event => {
        if(!active())return;
        const orgId=host._settingsContext.orgId,units=host._settingsContext.units;
        const form = event.target;
        if (!form.matches("#settings-organization-form, #settings-branch-form")) return;
        event.preventDefault();
        if (!canManageSettings()) return toast("Seu perfil não pode alterar configurações.");
        const values = new FormData(form);
        const name = String(values.get("name") || "").trim();
        const email = String(values.get("email") || "").trim();
        if (!name) return toast("Informe o nome.");
        if (email && !form.elements.email.validity.valid) return toast("Informe um e-mail válido.");

        const submit = form.querySelector('[type="submit"]');
        if(!submit||submit.disabled)return;
        submit.disabled = true;
        const payload = {
          name,
          phone: String(values.get("phone") || "").trim() || null,
          email: email || null,
          document: String(values.get("document") || "").trim() || null
        };
        try {
          if (form.id === "settings-organization-form") {
            const timezone = String(values.get("timezone") || "");
            if (!timezones.includes(timezone)) throw new Error("Selecione um fuso horário válido.");
            const { data, error } = await supabase.from("organizations")
              .update({ ...payload, timezone, updated_at: new Date().toISOString() })
              .eq("id", orgId).select("id").maybeSingle();
            if (error) throw error;
            if (!data) throw new Error("A organização não foi atualizada. Verifique sua permissão.");
            if(!active())return;
            state.organization = { ...state.organization, ...payload, timezone };
            toast("Dados da organização atualizados.");
          } else {
            const branchId = form.dataset.branchId;
            if (!branchId || !units.some(unit => unit.id === branchId)) throw new Error("Unidade inválida. Atualize a tela e tente novamente.");
            const { data, error } = await supabase.from("branches")
              .update({ ...payload, updated_at: new Date().toISOString() })
              .eq("id", branchId).eq("org_id", orgId).select("id").maybeSingle();
            if (error) throw error;
            if (!data) throw new Error("A unidade não foi atualizada. Verifique sua permissão.");
            if(!active())return;
            toast("Dados da unidade atualizados.");
          }
          host.querySelectorAll("dialog[open]").forEach(dialog => dialog.close());
          await reload();
        } catch (error) {
          reportError(error, { context: "Configurações > salvar dados cadastrais" });
        } finally {
          if (submit.isConnected) submit.disabled = false;
        }
      });
    }
}
