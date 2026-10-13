import { connection } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { listCustomerAccessCodes } from "@/lib/credits/access";
import { isAdminSession } from "../../api/_lib/admin-session";
import { IssueCodeForm } from "../_components/IssueCodeForm";
import { RevokeCodeButton } from "../_components/RevokeCodeButton";

export const instant = false;

export default async function AdminCodesPage() {
  await connection();
  const isAdmin = isAdminSession(await cookies());
  if (!isAdmin) {
    redirect("/admin");
  }

  const codes = await listCustomerAccessCodes(getDb());

  return (
    <main className="flex flex-1 flex-col gap-8 px-6 py-16">
      <h1 className="font-heading text-2xl font-semibold text-(--color-foreground)">Codes</h1>

      <IssueCodeForm />

      <div className="overflow-x-auto">
        <table className="w-full max-w-3xl text-left text-sm">
          <thead className="text-(--color-muted-foreground)">
            <tr>
              <th className="py-2 pr-4">Label</th>
              <th className="py-2 pr-4">Balance</th>
              <th className="py-2 pr-4">Created</th>
              <th className="py-2 pr-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {codes.map((code) => (
              <tr key={code.id} className="border-t border-(--color-border)">
                <td className="py-2 pr-4">{code.label}</td>
                <td className="py-2 pr-4">{code.creditsBalance}</td>
                <td className="py-2 pr-4 text-(--color-muted-foreground)">
                  {code.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                </td>
                <td className="py-2 pr-4">
                  <RevokeCodeButton accessCodeId={code.id} revoked={code.revokedAt !== null} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
