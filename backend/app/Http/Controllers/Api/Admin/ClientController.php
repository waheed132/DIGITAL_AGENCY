<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientController extends Controller
{
    /**
     * @param  list<string>  $colors
     * @return list<string>
     */
    private function normalizeBrandColorStrings(array $colors): array
    {
        $out = [];
        foreach ($colors as $c) {
            $t = trim((string) $c);
            if ($t === '') {
                continue;
            }
            if (! preg_match('/^#?[0-9A-Fa-f]{6}$/', $t)) {
                continue;
            }
            $withHash = str_starts_with($t, '#') ? $t : '#'.$t;
            $out[] = $withHash;
            if (count($out) >= 20) {
                break;
            }
        }

        return $out;
    }

    public function index(): JsonResponse
    {
        $rows = Client::query()->orderBy('name')->get();

        return response()->json($rows->map(fn (Client $c) => $c->toApiArray()));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'company' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:64'],
            'website' => ['nullable', 'url', 'max:2048'],
            'address' => ['nullable', 'string'],
            'brand_colors' => ['required', 'array', 'min:1', 'max:20'],
            'brand_colors.*' => ['required', 'string', 'regex:/^#?[0-9A-Fa-f]{6}$/'],
            'notes' => ['nullable', 'string'],
        ]);

        $colors = $this->normalizeBrandColorStrings($data['brand_colors']);
        unset($data['brand_colors']);
        $data['brand_colors'] = count($colors) > 0 ? $colors : null;
        $data['brand_primary'] = $colors[0] ?? null;
        $data['brand_secondary'] = $colors[1] ?? null;

        $client = Client::query()->create($data);

        return response()->json($client->fresh()->toApiArray(), 201);
    }

    public function show(Client $client): JsonResponse
    {
        $client->load('projects');

        return response()->json(array_merge($client->toApiArray(), [
            'projects' => $client->projects,
        ]));
    }

    public function update(Request $request, Client $client): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'company' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:64'],
            'website' => ['nullable', 'url', 'max:2048'],
            'address' => ['nullable', 'string'],
            'brand_colors' => ['required', 'array', 'min:1', 'max:20'],
            'brand_colors.*' => ['required', 'string', 'regex:/^#?[0-9A-Fa-f]{6}$/'],
            'notes' => ['nullable', 'string'],
        ]);

        $colors = $this->normalizeBrandColorStrings($data['brand_colors']);
        unset($data['brand_colors']);
        $data['brand_colors'] = count($colors) > 0 ? $colors : null;
        $data['brand_primary'] = $colors[0] ?? null;
        $data['brand_secondary'] = $colors[1] ?? null;

        $client->update($data);

        return response()->json($client->fresh()->toApiArray());
    }

    public function destroy(Client $client): JsonResponse
    {
        $client->delete();

        return response()->json(null, 204);
    }
}
