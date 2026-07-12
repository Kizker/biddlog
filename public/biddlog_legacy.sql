-- MySQL dump 10.13  Distrib 8.0.30, for Win64 (x86_64)
--
-- Host: localhost    Database: biddlog_db
-- ------------------------------------------------------
-- Server version	8.0.30

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `items`
--

DROP TABLE IF EXISTS `items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `raw_name` text COLLATE utf8mb4_unicode_ci,
  `brand` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `model` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `storage` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `grade` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unit_no` int DEFAULT '1',
  `auction_price` decimal(15,2) DEFAULT NULL,
  `assigned_to` int DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'parsed',
  `assigned_accounts` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `assigned_to` (`assigned_to`),
  CONSTRAINT `items_ibfk_1` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `items`
--

LOCK TABLES `items` WRITE;
/*!40000 ALTER TABLE `items` DISABLE KEYS */;
/*!40000 ALTER TABLE `items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendances`
--

DROP TABLE IF EXISTS `attendances`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendances` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `date` date NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'hadir',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_date` (`user_id`,`date`),
  CONSTRAINT `attendances_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendances`
--

LOCK TABLES `attendances` WRITE;
/*!40000 ALTER TABLE `attendances` DISABLE KEYS */;
/*!40000 ALTER TABLE `attendances` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `obtained_items`
--

DROP TABLE IF EXISTS `obtained_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `obtained_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `item_id` int DEFAULT NULL,
  `model` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `storage` int DEFAULT NULL,
  `grade` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `obtained_price` decimal(15,2) DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `obtained_items_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `obtained_items`
--

LOCK TABLES `obtained_items` WRITE;
/*!40000 ALTER TABLE `obtained_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `obtained_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `limits_and_fees`
--

DROP TABLE IF EXISTS `limits_and_fees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `limits_and_fees` (
  `id` int NOT NULL AUTO_INCREMENT,
  `model` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `grade` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `limit_price` decimal(15,2) DEFAULT NULL,
  `fee_amount` decimal(15,2) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=64 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `limits_and_fees`
--

LOCK TABLES `limits_and_fees` WRITE;
/*!40000 ALTER TABLE `limits_and_fees` DISABLE KEYS */;
INSERT INTO `limits_and_fees` VALUES (1,'fold 7 256','af',16520.00,100.00),(2,'s25u 256','ad',12750.00,50.00),(3,'fold 6 256','ag',11000.00,100.00),(4,'s25u 512','ad',13700.00,50.00),(5,'s25u 512','af',13300.00,50.00),(6,'fold 4 256','ag',5800.00,100.00),(7,'flip 6 256','ag',6250.00,50.00),(8,'s25 256','ac',8950.00,50.00),(9,'s25 256','ad',8950.00,50.00),(10,'s24u 512','ad',11750.00,50.00),(11,'s24u 512','ae',11400.00,50.00),(12,'s21 256','ai',1550.00,50.00),(13,'s24 fe 512','aa',6350.00,50.00),(14,'s24 fe 256','ad',5850.00,50.00),(15,'a53 256','ag',1650.00,50.00),(16,'s22 128','ae',3550.00,50.00),(17,'s24 fe 256','ag',5100.00,50.00),(18,'s22u 512','ad',6850.00,50.00),(19,'s22u 512','af',6300.00,50.00),(20,'s22u 512','aj',3000.00,50.00),(21,'flip 6 512','ac',7350.00,50.00),(22,'s25 fe 256','ab',6850.00,50.00),(23,'s23 256','ai',2720.00,50.00),(24,'s25u 256','ae',12400.00,50.00),(25,'s21 fe 256','af',2700.00,50.00),(26,'s25+ 512','ae',10150.00,50.00),(27,'s25+ 256','ae',9700.00,50.00),(28,'a72 128','af',1700.00,50.00),(29,'s22u 256','ae',5950.00,50.00),(30,'s22u 256','ag',4850.00,50.00),(31,'s23u 512','ae',8200.00,50.00),(32,'s24u 256','ad',10800.00,50.00),(33,'s24+ 256','ae',7150.00,50.00),(34,'a54 5g 256','ad',2900.00,50.00),(35,'s23 256','ae',5250.00,50.00),(36,'s23 fe 128','ag',3550.00,50.00),(37,'s24 256','ad',6900.00,50.00),(38,'s22 256','af',3700.00,50.00),(39,'s21u 512','ae',5000.00,50.00),(40,'s21u 512','ag',4450.00,50.00),(41,'s21u 512','ai',2550.00,50.00),(42,'s23u 256','af',7550.00,50.00),(43,'s23u 256','ag',7000.00,50.00),(44,'s23+ 256','ad',5650.00,50.00),(45,'s21u 256','ag',3850.00,50.00),(46,'s21+ 256','ae',3200.00,50.00),(47,'s21u 256','ai',2050.00,50.00),(48,'s23u 512','ag',7500.00,50.00),(49,'s23u 256','ae',7700.00,50.00),(50,'s20u 128','ag',2750.00,50.00),(51,'s20 128','ag',1850.00,50.00),(52,'s20+ 128','ai',1150.00,50.00),(53,'s20 fe 128','af',2020.00,50.00),(54,'s21+ 256','ag',2750.00,50.00),(55,'s21 fe 256','ae',2800.00,50.00),(56,'s21u 256','aj',1950.00,50.00),(57,'s10+ 128','ag',2250.00,50.00),(58,'a55 256','ad',3750.00,50.00),(59,'a55 256','ae',3750.00,50.00),(60,'note 20 256','af',2500.00,50.00),(61,'note 10+ 256','ag',3000.00,50.00),(62,'flip 5 512','ag',5100.00,50.00),(63,'flip 5 256','ag',4700.00,50.00);
/*!40000 ALTER TABLE `limits_and_fees` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_trail`
--

DROP TABLE IF EXISTS `audit_trail`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_trail` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `action` text COLLATE utf8mb4_unicode_ci,
  `target` text COLLATE utf8mb4_unicode_ci,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `audit_trail_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_trail`
--

LOCK TABLES `audit_trail` WRITE;
/*!40000 ALTER TABLE `audit_trail` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_trail` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-12 17:29:36
