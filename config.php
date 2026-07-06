<?php
/**
 * Mythralis — External Service Configuration
 * This file contains credentials for external API integrations.
 * IMPORTANT: Deny direct HTTP access to this file via .htaccess
 */

// SISReg III — Health Registry Credentials
define('SISREG_URL',  'https://sisregiii.saude.gov.br');
define('SISREG_USER', '2672839FRANCIELLY');
define('SISREG_PASS', 'rx580euteamo');

// Rate limiting (seconds between requests per IP)
define('SEARCH_RATE_LIMIT', 3);
