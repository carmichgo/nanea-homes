"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PlaidConnection } from "@/types";
import { formatDate } from "@/lib/utils";
import { usePlaidLink } from "react-plaid-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SyncResult {
  added: number;
  modified: number;
  removed: number;
}

function PlaidLinkButton({
  propertyId,
  onSuccess,
}: {
  propertyId: string;
  onSuccess: () => void;
}) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchLinkToken = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/plaid/create-link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property_id: propertyId }),
      });
      const data = await res.json();
      setLinkToken(data.link_token);
    } catch (err) {
      console.error("Failed to create link token:", err);
    } finally {
      setLoading(false);
    }
  };

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (publicToken, metadata) => {
      try {
        await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            public_token: publicToken,
            property_id: propertyId,
            institution: metadata.institution,
            account: metadata.accounts?.[0],
          }),
        });
        onSuccess();
      } catch (err) {
        console.error("Token exchange failed:", err);
      }
    },
  });

  useEffect(() => {
    if (linkToken && ready) {
      open();
    }
  }, [linkToken, ready, open]);

  return (
    <Button onClick={fetchLinkToken} disabled={loading}>
      {loading ? "Preparing..." : "Connect Bank Account"}
    </Button>
  );
}

export default function BankPage() {
  const params = useParams();
  const propertyId = params.id as string;
  const supabase = createClient();

  const [connection, setConnection] = useState<PlaidConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchConnection = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("plaid_connections")
      .select("*")
      .eq("property_id", propertyId)
      .maybeSingle();
    setConnection(data);
    setLoading(false);
  }, [propertyId, supabase]);

  useEffect(() => {
    fetchConnection();
  }, [fetchConnection]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/plaid/sync-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property_id: propertyId }),
      });
      const data = await res.json();
      setSyncResult({
        added: data.added ?? 0,
        modified: data.modified ?? 0,
        removed: data.removed ?? 0,
      });
      fetchConnection();
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!connection) return;
    setDisconnecting(true);
    try {
      await supabase
        .from("plaid_connections")
        .delete()
        .eq("id", connection.id);
      setConnection(null);
      setSyncResult(null);
    } catch (err) {
      console.error("Disconnect failed:", err);
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading bank connection...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Bank Connection</h1>

      {connection ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Connected Account</CardTitle>
              <Badge className="bg-green-100 text-green-800">Connected</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Institution</p>
                <p className="font-medium">
                  {connection.institution_name ?? "Unknown"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Account</p>
                <p className="font-medium">
                  {connection.account_name ?? "Account"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Account Number</p>
                <p className="font-medium">
                  ****{connection.account_mask ?? "----"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Last Synced</p>
                <p className="font-medium">
                  {connection.last_synced_at
                    ? formatDate(connection.last_synced_at)
                    : "Never"}
                </p>
              </div>
            </div>

            {syncResult && (
              <div className="rounded-md border p-4 text-sm">
                <p className="font-medium mb-2">Sync Results</p>
                <div className="flex gap-4">
                  <span className="text-green-700">
                    +{syncResult.added} added
                  </span>
                  <span className="text-blue-700">
                    ~{syncResult.modified} modified
                  </span>
                  <span className="text-red-700">
                    -{syncResult.removed} removed
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleSync} disabled={syncing}>
                {syncing ? "Syncing..." : "Sync Now"}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? "Disconnecting..." : "Disconnect"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Bank Connected</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Connect a bank account to automatically import transactions for
              this property.
            </p>
            <PlaidLinkButton
              propertyId={propertyId}
              onSuccess={fetchConnection}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
