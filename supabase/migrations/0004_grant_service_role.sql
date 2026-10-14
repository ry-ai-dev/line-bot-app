-- service_role への最小権限GRANT (FAQ応答が機能しない不具合の修正)
--
-- app/api/line-webhook/route.ts は createServiceClient() (service_role) で
-- faq/menus を select、conversations へ insert しているが、このプロジェクトの
-- デフォルト権限(pg_default_acl, defaclrole=postgres)は service_role に
-- SELECT/INSERT/UPDATE/DELETE を含んでいないため、0001/0003では authenticated
-- にしかGRANTしておらず、service_roleは一度もアクセス権を持っていなかった。
-- 他のテーブル・スキーマへの権限は変更しない。

grant select on faq to service_role;
grant select on menus to service_role;
grant insert on conversations to service_role;
