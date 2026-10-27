import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import {
  generateBriefLocationVisual,
  generateBriefPropertyVisual,
  removeCharacterVisual,
  storeBriefCharacterVisual,
  storeBriefLocationVisual,
  storeBriefPropertyVisual,
} from "@/thinking-lab/execution/generateCharacterVisual";
import { CharacterVisualSlots, type CharacterStudioTab } from "@/thinking-lab/section/CharacterVisualStudio";
import { LocationVisualCard } from "@/6-1-dashboard/modal/LocationVisualCard";
import { lookFromBriefStoryboard } from "@/6-1-dashboard/modal/locationImagePrompt";
import {
  briefAssetHandle,
  locationContentShape,
  locationFrameForContentType,
  type BriefConceptAsset,
  type BriefConceptDocument,
  type BriefPostAspect,
} from "@/6-1-dashboard/modal/briefConceptAssets";

function AssetText({
  item,
  onDescription,
  onRemove,
}: {
  item: BriefConceptAsset;
  onDescription: (description: string) => void;
  onRemove: () => void;
}) {
  const { t } = useAppTranslation();
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="shrink-0 font-medium text-foreground">{item.handle}</span>
      <Input
        value={item.description}
        onChange={(event) => onDescription(event.target.value)}
        placeholder={t("briefDialog.conceptDescription", "Description")}
        aria-label={t("briefDialog.conceptDescription", "Description")}
        className="h-8 min-w-0 flex-1 text-sm"
      />
      <Button type="button" size="sm" variant="ghost" className="h-7 w-7 shrink-0 p-0" aria-label={t("briefDialog.conceptRemove", "Remove")} onClick={onRemove}>
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
      </Button>
    </div>
  );
}

function AddAsset({
  prefix,
  placeholder,
  onAdd,
}: {
  prefix: "location" | "character" | "property";
  placeholder: string;
  onAdd: (asset: BriefConceptAsset) => void;
}) {
  const { t } = useAppTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  return (
    <form
      className="mt-2 flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) return;
        onAdd({ handle: briefAssetHandle(name, prefix), description: description.trim() });
        setName("");
        setDescription("");
      }}
    >
      <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={placeholder} className="h-8 max-w-[12rem] text-sm" />
      <Input
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder={t("briefDialog.conceptDescription", "Description")}
        className="h-8 min-w-[12rem] flex-1 text-sm"
      />
      <Button type="submit" size="sm" variant="outline" className="h-8">
        <Plus className="h-3.5 w-3.5" aria-hidden />
        {t("briefDialog.conceptAdd", "Add")}
      </Button>
    </form>
  );
}

export function BriefConceptEditor({
  planId,
  planTitle = "",
  briefText = "",
  captionText = "",
  contentTypeName = "",
  document,
  onChange,
}: {
  planId?: string;
  planTitle?: string;
  briefText?: string;
  captionText?: string;
  contentTypeName?: string;
  document: BriefConceptDocument;
  onChange: (next: BriefConceptDocument) => void;
}) {
  const { t } = useAppTranslation();
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const [saving, setSaving] = useState<{ handle: string; kind: CharacterStudioTab } | null>(null);
  const [locationBusy, setLocationBusy] = useState<{ handle: string; mode: "upload" | "generate" } | null>(null);
  const [propertyBusy, setPropertyBusy] = useState<{ handle: string; mode: "upload" | "generate" } | null>(null);
  const shape = locationContentShape(contentTypeName);
  const frame = locationFrameForContentType(contentTypeName, document.postAspect);

  const updateCharacter = (handle: string, patch: Partial<BriefConceptAsset>) => {
    onChange({
      ...document,
      characters: document.characters.map((item) => (item.handle === handle ? { ...item, ...patch, visualRevision: Date.now() } : item)),
    });
  };

  const upload = async (handle: string, kind: CharacterStudioTab, file: File) => {
    if (!organizationId || !planId) {
      toast.error(t("briefDialog.conceptPlanRequired", "Save the plan before uploading a character image."));
      return;
    }
    const character = document.characters.find((item) => item.handle === handle);
    if (!character) return;
    setSaving({ handle, kind });
    try {
      const path = await storeBriefCharacterVisual({
        organizationId,
        planId,
        handle,
        kind,
        file,
        previousPath: kind === "portrait" ? character.portraitPath : character.bodyPath,
      });
      updateCharacter(handle, kind === "portrait" ? { portraitPath: path } : { bodyPath: path });
    } catch (error) {
      toast.error(error instanceof Error && error.message
        ? error.message
        : t("thinkingLab.execution.characterUploadFailed", "The character image could not be uploaded."));
    } finally {
      setSaving(null);
    }
  };

  const removeVisual = async (handle: string, kind: CharacterStudioTab) => {
    const character = document.characters.find((item) => item.handle === handle);
    const path = kind === "portrait" ? character?.portraitPath : character?.bodyPath;
    if (!character || !path) return;
    const next = { ...character, visualRevision: Date.now() };
    if (kind === "portrait") delete next.portraitPath;
    else delete next.bodyPath;
    onChange({
      ...document,
      characters: document.characters.map((item) => (item.handle === handle ? next : item)),
    });
    if (path.includes("/brief/")) {
      try {
        await removeCharacterVisual(path);
      } catch {
        // The concept no longer points at this file.
      }
    }
  };

  const updateDescription = (
    kind: "locations" | "characters" | "properties",
    handle: string,
    description: string,
  ) => {
    onChange({
      ...document,
      [kind]: document[kind].map((item) => (item.handle === handle ? { ...item, description } : item)),
    });
  };

  const updateLocation = (handle: string, patch: Partial<BriefConceptAsset>) => {
    onChange({
      ...document,
      locations: document.locations.map((item) => (item.handle === handle ? { ...item, ...patch, visualRevision: Date.now() } : item)),
    });
  };

  const requireLocationTarget = () => {
    if (!organizationId || !planId) {
      toast.error(t("briefDialog.conceptPlanRequired", "Save the plan before uploading a character image."));
      return false;
    }
    if (!frame) {
      toast.error(
        shape === "feed"
          ? t("briefDialog.conceptLocationSizeHint", "Choose 4:5 or 1:1 before uploading or generating.")
          : t("briefDialog.conceptLocationTypeRequired", "Select a content type on the plan first."),
      );
      return false;
    }
    return true;
  };

  const uploadLocation = async (handle: string, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error(t("briefDialog.conceptLocationGenerateFailed", "The location image could not be generated."));
      return;
    }
    if (!requireLocationTarget() || !organizationId || !planId) return;
    const location = document.locations.find((item) => item.handle === handle);
    if (!location) return;
    setLocationBusy({ handle, mode: "upload" });
    try {
      const path = await storeBriefLocationVisual({
        organizationId,
        planId,
        handle,
        file,
        previousPath: location.locationPath,
      });
      updateLocation(handle, { locationPath: path });
      toast.success(t("briefDialog.conceptLocationUploaded", "Location image uploaded."));
    } catch (error) {
      toast.error(error instanceof Error && error.message
        ? error.message
        : t("briefDialog.conceptLocationGenerateFailed", "The location image could not be generated."));
    } finally {
      setLocationBusy(null);
    }
  };

  const generateLocation = async (handle: string) => {
    if (!requireLocationTarget() || !organizationId || !planId || !frame) return;
    const location = document.locations.find((item) => item.handle === handle);
    if (!location) return;
    setLocationBusy({ handle, mode: "generate" });
    try {
      const path = await generateBriefLocationVisual({
        organizationId,
        planId,
        handle,
        description: location.description,
        aspect: frame,
        previousPath: location.locationPath,
        title: planTitle,
        caption: captionText,
        storyboard: briefText,
        concept: document,
        look: lookFromBriefStoryboard(briefText),
      });
      updateLocation(handle, { locationPath: path });
      toast.success(t("briefDialog.conceptLocationGenerated", "Location image ready."));
    } catch (error) {
      toast.error(error instanceof Error && error.message
        ? error.message
        : t("briefDialog.conceptLocationGenerateFailed", "The location image could not be generated."));
    } finally {
      if (planId) void queryClient.invalidateQueries({ queryKey: ["content-ai-usage", planId] });
      setLocationBusy(null);
    }
  };

  const removeLocationVisual = async (handle: string) => {
    const location = document.locations.find((item) => item.handle === handle);
    const path = location?.locationPath;
    if (!location || !path) return;
    const next = { ...location, visualRevision: Date.now() };
    delete next.locationPath;
    onChange({
      ...document,
      locations: document.locations.map((item) => (item.handle === handle ? next : item)),
    });
    if (path.includes("/brief/")) {
      try {
        await removeCharacterVisual(path);
      } catch {
        // The concept no longer points at this file.
      }
    }
  };

  const updateProperty = (handle: string, patch: Partial<BriefConceptAsset>) => {
    onChange({
      ...document,
      properties: document.properties.map((item) => (item.handle === handle ? { ...item, ...patch, visualRevision: Date.now() } : item)),
    });
  };

  const uploadProperty = async (handle: string, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error(t("briefDialog.conceptPropertyFailed", "The property image could not be saved."));
      return;
    }
    if (!requireLocationTarget() || !organizationId || !planId) return;
    const property = document.properties.find((item) => item.handle === handle);
    if (!property) return;
    setPropertyBusy({ handle, mode: "upload" });
    try {
      const path = await storeBriefPropertyVisual({
        organizationId,
        planId,
        handle,
        file,
        previousPath: property.propertyPath,
      });
      updateProperty(handle, { propertyPath: path });
      toast.success(t("briefDialog.conceptPropertyUploaded", "Property image uploaded."));
    } catch (error) {
      toast.error(error instanceof Error && error.message
        ? error.message
        : t("briefDialog.conceptPropertyFailed", "The property image could not be saved."));
    } finally {
      setPropertyBusy(null);
    }
  };

  const generateProperty = async (handle: string) => {
    if (!requireLocationTarget() || !organizationId || !planId || !frame) return;
    const property = document.properties.find((item) => item.handle === handle);
    if (!property) return;
    setPropertyBusy({ handle, mode: "generate" });
    try {
      const path = await generateBriefPropertyVisual({
        organizationId,
        planId,
        handle,
        description: property.description,
        aspect: frame,
        previousPath: property.propertyPath,
        title: planTitle,
        caption: captionText,
        storyboard: briefText,
        concept: document,
        look: lookFromBriefStoryboard(briefText),
      });
      updateProperty(handle, { propertyPath: path });
      toast.success(t("briefDialog.conceptPropertyGenerated", "Property image ready."));
    } catch (error) {
      toast.error(error instanceof Error && error.message
        ? error.message
        : t("briefDialog.conceptPropertyFailed", "The property image could not be saved."));
    } finally {
      if (planId) void queryClient.invalidateQueries({ queryKey: ["content-ai-usage", planId] });
      setPropertyBusy(null);
    }
  };

  const removePropertyVisual = async (handle: string) => {
    const property = document.properties.find((item) => item.handle === handle);
    const path = property?.propertyPath;
    if (!property || !path) return;
    const next = { ...property, visualRevision: Date.now() };
    delete next.propertyPath;
    onChange({
      ...document,
      properties: document.properties.map((item) => (item.handle === handle ? next : item)),
    });
    if (path.includes("/brief/")) {
      try {
        await removeCharacterVisual(path);
      } catch {
        // The concept no longer points at this file.
      }
    }
  };

  const choosePostAspect = (postAspect: BriefPostAspect) => {
    onChange({ ...document, postAspect });
  };

  return (
    <div className="scrollbar-hide h-full min-h-0 space-y-4 overflow-y-auto pr-1 text-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {document.voiceOver?.trim() ? (
        <section className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="font-medium text-foreground">{t("briefDialog.conceptVoiceOver", "Script VO")}</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-800">{document.voiceOver}</p>
        </section>
      ) : null}
      <section>
        <p className="font-medium text-foreground">Location</p>
        {shape === "feed" ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {t("briefDialog.conceptLocationSize", "Choose the {{type}} size", { type: contentTypeName || "Post" })}
            </span>
            {(["4:5", "1:1"] as const).map((aspect) => (
              <Button
                key={aspect}
                type="button"
                size="sm"
                variant={document.postAspect === aspect ? "default" : "outline"}
                className="h-7 rounded-md px-2.5 text-xs"
                onClick={() => choosePostAspect(aspect)}
              >
                {aspect}
              </Button>
            ))}
          </div>
        ) : null}
        {shape === "feed" && !document.postAspect ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {t("briefDialog.conceptLocationSizeHint", "Choose 4:5 or 1:1 before uploading or generating.")}
          </p>
        ) : null}
        {shape === "unknown" ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {t("briefDialog.conceptLocationTypeRequired", "Select a content type on the plan first.")}
          </p>
        ) : null}
        <ul className="mt-1 space-y-3">
          {document.locations.map((item) => (
            <li key={item.handle}>
              <AssetText
                item={item}
                onDescription={(description) => updateDescription("locations", item.handle, description)}
                onRemove={() => onChange({ ...document, locations: document.locations.filter((row) => row.handle !== item.handle) })}
              />
              {frame ? (
                <LocationVisualCard
                  label={item.handle}
                  path={item.locationPath}
                  revision={item.visualRevision}
                  frame={frame}
                  busy={locationBusy?.handle === item.handle}
                  generating={locationBusy?.handle === item.handle && locationBusy.mode === "generate"}
                  disabled={Boolean(locationBusy) && locationBusy?.handle !== item.handle}
                  onUpload={(file) => void uploadLocation(item.handle, file)}
                  onGenerate={() => void generateLocation(item.handle)}
                  onDelete={() => void removeLocationVisual(item.handle)}
                />
              ) : null}
            </li>
          ))}
        </ul>
        <AddAsset
          prefix="location"
          placeholder={t("briefDialog.conceptLocation", "Location name")}
          onAdd={(asset) => onChange({ ...document, locations: [...document.locations, asset] })}
        />
      </section>
      <section>
        <p className="font-medium text-foreground">Character</p>
        <ul className="mt-1 space-y-4">
          {document.characters.map((item) => (
            <li key={item.handle}>
              <AssetText
                item={item}
                onDescription={(description) => updateDescription("characters", item.handle, description)}
                onRemove={() => onChange({ ...document, characters: document.characters.filter((row) => row.handle !== item.handle) })}
              />
              <CharacterVisualSlots
                character={item}
                savingKind={saving?.handle === item.handle ? saving.kind : null}
                disabled={Boolean(saving)}
                onUploadFile={(kind, file) => void upload(item.handle, kind, file)}
                onUseProjectImage={() => undefined}
                onDelete={(kind) => void removeVisual(item.handle, kind)}
                showProjectPicker={false}
              />
            </li>
          ))}
        </ul>
        <AddAsset
          prefix="character"
          placeholder={t("briefDialog.conceptCharacter", "Character name")}
          onAdd={(asset) => onChange({ ...document, characters: [...document.characters, asset] })}
        />
      </section>
      <section>
        <p className="font-medium text-foreground">Property</p>
        {shape === "feed" ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {t("briefDialog.conceptLocationSize", "Choose the {{type}} size", { type: contentTypeName || "Post" })}
            </span>
            {(["4:5", "1:1"] as const).map((aspect) => (
              <Button
                key={aspect}
                type="button"
                size="sm"
                variant={document.postAspect === aspect ? "default" : "outline"}
                className="h-7 rounded-md px-2.5 text-xs"
                onClick={() => choosePostAspect(aspect)}
              >
                {aspect}
              </Button>
            ))}
          </div>
        ) : null}
        {shape === "feed" && !document.postAspect ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {t("briefDialog.conceptLocationSizeHint", "Choose 4:5 or 1:1 before uploading or generating.")}
          </p>
        ) : null}
        <ul className="mt-1 space-y-3">
          {document.properties.map((item) => (
            <li key={item.handle}>
              <AssetText
                item={item}
                onDescription={(description) => updateDescription("properties", item.handle, description)}
                onRemove={() => onChange({ ...document, properties: document.properties.filter((row) => row.handle !== item.handle) })}
              />
              {frame ? (
                <LocationVisualCard
                  label={item.handle}
                  path={item.propertyPath}
                  revision={item.visualRevision}
                  frame={frame}
                  busy={propertyBusy?.handle === item.handle}
                  generating={propertyBusy?.handle === item.handle && propertyBusy.mode === "generate"}
                  disabled={Boolean(propertyBusy) && propertyBusy?.handle !== item.handle}
                  emptyLabel={t("briefDialog.conceptPropertyImage", "Create or add your property image")}
                  deleteLabel={t("briefDialog.conceptPropertyDelete", "Delete property image")}
                  onUpload={(file) => void uploadProperty(item.handle, file)}
                  onGenerate={() => void generateProperty(item.handle)}
                  onDelete={() => void removePropertyVisual(item.handle)}
                />
              ) : null}
            </li>
          ))}
        </ul>
        <AddAsset
          prefix="property"
          placeholder={t("briefDialog.conceptProperty", "Property name")}
          onAdd={(asset) => onChange({ ...document, properties: [...document.properties, asset] })}
        />
      </section>
    </div>
  );
}
