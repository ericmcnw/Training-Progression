import { Prisma } from "@/generated/prisma";
import { getAppSession } from "@/lib/auth";
import { basePrisma } from "@/lib/prisma-base";
import {
  scopeArgs,
  scopeNestedReads,
  toLogicalSyntheticIds,
  toPhysicalSyntheticIds,
  type RelationMap,
} from "@/lib/profile-scope";

const relations: RelationMap = Object.fromEntries(
  Prisma.dmmf.datamodel.models.map((model) => [
    model.name,
    Object.fromEntries(
      model.fields
        .filter((field) => field.kind === "object")
        .map((field) => [field.name, { target: field.type, isList: field.isList }])
    ),
  ])
);

export const prisma = basePrisma.$extends({
  name: "profile-scope",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const { profileKey } = await getAppSession();
        const scoped = scopeNestedReads(model, scopeArgs(model, operation, args, profileKey), profileKey, relations);
        const physical = toPhysicalSyntheticIds(scoped, profileKey);
        return toLogicalSyntheticIds(await query(physical as typeof args), profileKey);
      },
    },
  },
});

export type PrismaTx = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;
