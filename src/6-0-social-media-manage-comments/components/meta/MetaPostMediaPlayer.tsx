import { useTranslation } from 'react-i18next';

type MetaPostMediaPlayerProps = {
  coverImageUrl: string | null;
  title: string;
};

/** Matches TikTok preview card width/aspect; Meta posts use image instead of iframe. */
export function MetaPostMediaPlayer({ coverImageUrl, title }: MetaPostMediaPlayerProps) {
  const { t } = useTranslation();

  if (!coverImageUrl) {
    return (
      <div className="mx-auto flex w-full max-w-[325px] aspect-[9/16] items-center justify-center bg-gray-100 px-4 text-center text-sm text-muted-foreground">
        {t('digitalMarketing.manageComments.metaPreviewNoMedia', 'No preview image for this post.')}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[325px] overflow-hidden bg-black">
      <div className="relative aspect-[9/16] w-full">
        <img
          src={coverImageUrl}
          alt={title}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    </div>
  );
}
