-- AlterTable: add wishlistIds to User
ALTER TABLE `User` ADD COLUMN `wishlistIds` JSON NULL;

-- CreateTable: Setting (key-value store for admin settings)
CREATE TABLE `Setting` (
    `key` VARCHAR(191) NOT NULL,
    `value` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
