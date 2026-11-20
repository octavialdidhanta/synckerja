create table public.kol_profiles (
  id uuid not null default gen_random_uuid (),
  organization_id uuid not null,
  name text not null,
  email text null,
  phone text null,
  bio text null,
  profile_photo_url text null,
  category text null,
  status text not null default 'active'::text,
  location text null,
  age integer null,
  gender text null,
  notes text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  created_by uuid null,
  website_url text null,
  languages_spoken text null,
  specialties text null,
  preferred_communication text null,
  niche text null,
  followers_count bigint null default 0,
  engagement_rate numeric null default 0,
  average_views bigint null default 0,
  total_posts integer null default 0,
  constraint kol_profiles_pkey primary key (id),
  constraint kol_profiles_created_by_fkey foreign KEY (created_by) references auth.users (id),
  constraint kol_profiles_organization_id_fkey foreign KEY (organization_id) references organizations (id)
) TABLESPACE pg_default;

create index IF not exists idx_kol_profiles_organization_id on public.kol_profiles using btree (organization_id) TABLESPACE pg_default;

create trigger kol_profiles_updated_at BEFORE
update on kol_profiles for EACH row
execute FUNCTION update_kol_updated_at ();

create table public.kol_rates (
  id uuid not null default gen_random_uuid (),
  kol_profile_id uuid not null,
  platform text not null,
  content_type text not null,
  rate_amount numeric(12, 2) not null,
  currency text null default 'IDR'::text,
  rate_type text null default 'per_post'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint kol_rates_pkey primary key (id),
  constraint kol_rates_kol_profile_id_fkey foreign KEY (kol_profile_id) references kol_profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_kol_rates_kol_profile_id on public.kol_rates using btree (kol_profile_id) TABLESPACE pg_default;

create trigger kol_rates_updated_at BEFORE
update on kol_rates for EACH row
execute FUNCTION update_kol_updated_at ();

create table public.kol_ratings (
  id uuid not null default gen_random_uuid (),
  kol_profile_id uuid not null,
  organization_id uuid not null,
  overall_rating integer not null,
  content_quality_rating integer null,
  communication_rating integer null,
  professionalism_rating integer null,
  would_collaborate_again boolean null,
  rated_by uuid not null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  audience_engagement_rating integer null,
  brand_alignment_rating integer null,
  areas_for_improvement text null,
  collaboration_highlights text null,
  feedback text null,
  roi_rating integer null,
  satisfaction_rating integer null,
  adherence_to_brief_rating integer null,
  campaign_id uuid null,
  constraint kol_ratings_pkey primary key (id),
  constraint kol_ratings_rated_by_fkey foreign KEY (rated_by) references auth.users (id),
  constraint fk_kol_ratings_kol_profile foreign KEY (kol_profile_id) references kol_profiles (id) on delete CASCADE,
  constraint fk_kol_ratings_organization foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint kol_ratings_kol_profile_id_fkey foreign KEY (kol_profile_id) references kol_profiles (id) on delete CASCADE,
  constraint kol_ratings_organization_id_fkey foreign KEY (organization_id) references organizations (id) on delete CASCADE,
  constraint check_professionalism_rating check (
    (
      (professionalism_rating >= 1)
      and (professionalism_rating <= 5)
    )
  ),
  constraint check_roi_rating check (
    (
      (roi_rating >= 1)
      and (roi_rating <= 5)
    )
  ),
  constraint check_satisfaction_rating check (
    (
      (satisfaction_rating >= 1)
      and (satisfaction_rating <= 5)
    )
  ),
  constraint kol_ratings_overall_rating_check check (
    (
      ((overall_rating)::numeric >= (1)::numeric)
      and ((overall_rating)::numeric <= (5)::numeric)
    )
  ),
  constraint check_audience_engagement_rating check (
    (
      (audience_engagement_rating >= 1)
      and (audience_engagement_rating <= 5)
    )
  ),
  constraint kol_ratings_communication_rating_check check (
    (
      ((communication_rating)::numeric >= (1)::numeric)
      and ((communication_rating)::numeric <= (5)::numeric)
    )
  ),
  constraint kol_ratings_content_quality_rating_check check (
    (
      ((content_quality_rating)::numeric >= (1)::numeric)
      and ((content_quality_rating)::numeric <= (5)::numeric)
    )
  ),
  constraint kol_ratings_professionalism_rating_check check (
    (
      ((professionalism_rating)::numeric >= (1)::numeric)
      and ((professionalism_rating)::numeric <= (5)::numeric)
    )
  ),
  constraint check_adherence_to_brief_rating check (
    (
      (adherence_to_brief_rating >= 1)
      and (adherence_to_brief_rating <= 5)
    )
  ),
  constraint check_brand_alignment_rating check (
    (
      (brand_alignment_rating >= 1)
      and (brand_alignment_rating <= 5)
    )
  ),
  constraint check_communication_rating check (
    (
      (communication_rating >= 1)
      and (communication_rating <= 5)
    )
  ),
  constraint check_content_quality_rating check (
    (
      (content_quality_rating >= 1)
      and (content_quality_rating <= 5)
    )
  ),
  constraint check_overall_rating check (
    (
      (overall_rating >= 1)
      and (overall_rating <= 5)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_kol_ratings_kol_profile_id on public.kol_ratings using btree (kol_profile_id) TABLESPACE pg_default;

create index IF not exists idx_kol_ratings_profile_org on public.kol_ratings using btree (kol_profile_id, organization_id) TABLESPACE pg_default;

create index IF not exists idx_kol_ratings_overall_rating on public.kol_ratings using btree (overall_rating) TABLESPACE pg_default;

create trigger kol_ratings_updated_at BEFORE
update on kol_ratings for EACH row
execute FUNCTION handle_updated_at ();

create trigger update_kol_ratings_updated_at BEFORE
update on kol_ratings for EACH row
execute FUNCTION update_kol_ratings_updated_at ();

create table public.kol_social_media_accounts (
  id uuid not null default gen_random_uuid (),
  kol_profile_id uuid not null,
  platform text not null,
  username text not null,
  profile_url text null,
  followers integer null default 0,
  engagement_rate numeric(5, 2) null default 0.00,
  average_views integer null default 0,
  is_verified boolean null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint kol_social_media_accounts_pkey primary key (id),
  constraint kol_social_media_accounts_kol_profile_id_fkey foreign KEY (kol_profile_id) references kol_profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_kol_social_media_accounts_kol_profile_id on public.kol_social_media_accounts using btree (kol_profile_id) TABLESPACE pg_default;

create trigger kol_social_media_accounts_updated_at BEFORE
update on kol_social_media_accounts for EACH row
execute FUNCTION update_kol_updated_at ();

