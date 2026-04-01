-- AddColumn: age range and parental guidance fields to Book
ALTER TABLE `Book`
  ADD COLUMN `minAge` INTEGER NULL,
  ADD COLUMN `maxAge` INTEGER NULL,
  ADD COLUMN `needsParentalGuide` BOOLEAN NOT NULL DEFAULT false;
