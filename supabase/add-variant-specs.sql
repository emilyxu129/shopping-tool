-- Adds flexible product specs such as color, inseam, width, or material.
-- Run this once in Supabase SQL Editor if your tracked_products table already exists.

alter table tracked_products
add column if not exists variant_specs text not null default '';
