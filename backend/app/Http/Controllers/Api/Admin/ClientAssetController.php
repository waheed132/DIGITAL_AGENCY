<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ClientAssetController extends Controller
{
    public function storeLogo(Request $request, Client $client): JsonResponse
    {
        $data = $request->validate([
            'file' => ['required', 'file', 'max:10240', 'mimetypes:image/jpeg,image/png,image/webp'],
        ]);

        $file = $data['file'];
        if ($client->logo_path) {
            Storage::disk('public')->delete($client->logo_path);
        }
        $path = $file->store('client-logos', 'public');
        $client->update(['logo_path' => $path]);

        return response()->json(['logo_url' => '/api/client-files/'.$client->id.'/logo']);
    }

    public function destroyLogo(Client $client): JsonResponse
    {
        if ($client->logo_path) {
            Storage::disk('public')->delete($client->logo_path);
            $client->update(['logo_path' => null]);
        }

        return response()->json(null, 204);
    }

    public function storeBusinessProfile(Request $request, Client $client): JsonResponse
    {
        $data = $request->validate([
            'file' => ['required', 'file', 'max:20480', 'mimetypes:application/pdf'],
        ]);

        $file = $data['file'];
        if ($client->business_profile_pdf_path) {
            Storage::disk('public')->delete($client->business_profile_pdf_path);
        }
        $path = $file->store('client-business-profiles', 'public');
        $client->update(['business_profile_pdf_path' => $path]);

        return response()->json(['business_profile_url' => '/api/client-files/'.$client->id.'/business-profile']);
    }

    public function destroyBusinessProfile(Client $client): JsonResponse
    {
        if ($client->business_profile_pdf_path) {
            Storage::disk('public')->delete($client->business_profile_pdf_path);
            $client->update(['business_profile_pdf_path' => null]);
        }

        return response()->json(null, 204);
    }
}
