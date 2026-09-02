-- Allow wall / dinding as a floor-plan fixture type.

ALTER TABLE public.pos_floor_fixtures
  DROP CONSTRAINT IF EXISTS pos_floor_fixtures_type_check;

ALTER TABLE public.pos_floor_fixtures
  ADD CONSTRAINT pos_floor_fixtures_type_check CHECK (
    fixture_type IN (
      'cashier',
      'stairs',
      'door',
      'wall',
      'kitchen',
      'washbasin',
      'kiosk',
      'parking'
    )
  );
