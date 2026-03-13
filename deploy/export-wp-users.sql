-- ══════════════════════════════════════════════════════════════
-- export-wp-users.sql
-- تصدير بيانات عملاء WordPress (الأسماء والإيميلات)
-- ══════════════════════════════════════════════════════════════
--
-- طريقة الاستخدام على السيرفر:
--   mysql -u root -p wordpress_db_name < export-wp-users.sql
-- أو عبر phpMyAdmin: افتح SQL tab والصق هذا الكود
--
-- النتيجة: ملف CSV في /tmp/wp-customers.csv
-- ══════════════════════════════════════════════════════════════

-- ── تصدير الأسماء والإيميلات ─────────────────────────────────
SELECT
    u.ID                        AS user_id,
    u.display_name              AS name,
    u.user_email                AS email,
    u.user_registered           AS registered_date,
    MAX(CASE WHEN um.meta_key = 'first_name' THEN um.meta_value END) AS first_name,
    MAX(CASE WHEN um.meta_key = 'last_name'  THEN um.meta_value END) AS last_name,
    MAX(CASE WHEN um.meta_key = 'billing_phone' THEN um.meta_value END) AS phone,
    MAX(CASE WHEN um.meta_key = 'billing_country' THEN um.meta_value END) AS country
FROM wp_users u
LEFT JOIN wp_usermeta um ON u.ID = um.user_id
WHERE u.ID IN (
    -- فقط الـ customers (مش الـ admins)
    SELECT DISTINCT user_id FROM wp_usermeta
    WHERE meta_key = 'wp_capabilities'
    AND meta_value LIKE '%customer%'
)
GROUP BY u.ID, u.display_name, u.user_email, u.user_registered
ORDER BY u.user_registered DESC

INTO OUTFILE '/tmp/wp-customers.csv'
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n';

-- ══════════════════════════════════════════════════════════════
-- بعد التصدير، انقل الملف لجهازك:
--   scp root@SERVER_IP:/tmp/wp-customers.csv ./wp-customers.csv
--
-- ملاحظة: الموقع الجديد يستخدم localStorage للمستخدمين.
-- الداتا المستخرجة تُستخدم للرجوع إليها أو إرسال إيميل للعملاء
-- القدامى لإعلامهم بالموقع الجديد.
-- ══════════════════════════════════════════════════════════════
