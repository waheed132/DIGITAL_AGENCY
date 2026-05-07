<?php

namespace App\Services;

class IntakeToClientMapper
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public static function buildNotes(array $payload): string
    {
        $lines = [];

        if (! empty($payload['businessDescription'])) {
            $lines[] = 'About: '.$payload['businessDescription'];
        }
        if (! empty($payload['industry'])) {
            $lines[] = 'Industry: '.$payload['industry'];
        }
        if (! empty($payload['problemYouSolve'])) {
            $lines[] = 'Problem solved: '.$payload['problemYouSolve'];
        }
        if (! empty($payload['uniqueValue'])) {
            $lines[] = 'Unique value: '.$payload['uniqueValue'];
        }
        if (! empty($payload['idealCustomer'])) {
            $lines[] = 'Ideal customer: '.$payload['idealCustomer'];
        }
        if (! empty($payload['mainGoal']) || ! empty($payload['budgetRange']) || ! empty($payload['timeline'])) {
            $lines[] = sprintf(
                'Goals: %s | Budget: %s | Timeline: %s',
                $payload['mainGoal'] ?? '—',
                $payload['budgetRange'] ?? '—',
                $payload['timeline'] ?? '—'
            );
        }

        $services = [];
        foreach (['serviceLogo' => 'Logo', 'serviceSocial' => 'Social', 'serviceWebsite' => 'Website', 'serviceAds' => 'Ads', 'serviceContent' => 'Content'] as $key => $label) {
            if (! empty($payload[$key])) {
                $services[] = $label;
            }
        }
        if ($services !== []) {
            $lines[] = 'Services requested: '.implode(', ', $services);
        }

        if (! empty($payload['serviceQuantity']) && is_string($payload['serviceQuantity']) && trim($payload['serviceQuantity']) !== '') {
            $lines[] = 'Quantity / scope notes: '.trim($payload['serviceQuantity']);
        }

        if (! empty($payload['logoDataUrl']) && is_string($payload['logoDataUrl']) && str_starts_with($payload['logoDataUrl'], 'data:image/')) {
            $lines[] = 'Logo: submitted with this intake (stored in intake payload). Open intake detail to download or copy.';
        }

        return implode("\n\n", array_filter($lines));
    }

    /**
     * Trim and validate; returns lowercase canonical email or null.
     */
    public static function normalizeEmail(mixed $email): ?string
    {
        if (! is_string($email)) {
            return null;
        }
        $t = trim($email);
        if ($t === '') {
            return null;
        }
        if (! filter_var($t, FILTER_VALIDATE_EMAIL)) {
            return null;
        }

        return mb_strtolower($t);
    }

    public static function normalizeWebsite(?string $url): ?string
    {
        if ($url === null) {
            return null;
        }
        $t = trim($url);
        if ($t === '') {
            return null;
        }
        if (! preg_match('#^https?://#i', $t)) {
            $t = 'https://'.$t;
        }

        return filter_var($t, FILTER_VALIDATE_URL) ? $t : null;
    }

    /**
     * @return array{0: ?string, 1: ?string}
     */
    public static function extractBrandHexPair(?string $preferredColors): array
    {
        if ($preferredColors === null || trim($preferredColors) === '') {
            return [null, null];
        }
        if (preg_match_all('/#[0-9A-Fa-f]{6}/', $preferredColors, $m)) {
            $first = $m[0][0] ?? null;
            $second = $m[0][1] ?? null;

            return [$first, $second];
        }

        return [null, null];
    }
}
