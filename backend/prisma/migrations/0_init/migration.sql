-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" VARCHAR(50) NOT NULL,
    "target_type" VARCHAR(50) NOT NULL,
    "target_id" UUID,
    "detail" JSONB,
    "ip_address" VARCHAR(50),
    "method" VARCHAR(10),
    "path" VARCHAR(200),
    "status_code" INTEGER,
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6),

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "import_time" TIMESTAMPTZ(6),
    "file_name" VARCHAR(255),
    "total_count" INTEGER,
    "success_count" INTEGER,
    "fail_count" INTEGER,
    "creator_id" UUID,
    "original_file_path" VARCHAR(500),
    "reporting_unit" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enterprises" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "credit_code" VARCHAR(50),
    "region" VARCHAR(100),
    "address" VARCHAR(500),
    "contact_person" VARCHAR(100),
    "industry_sector" VARCHAR(100),
    "enterprise_type" VARCHAR(50),
    "created_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "enterprises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hazard_status_history" (
    "id" UUID NOT NULL,
    "hazard_id" UUID NOT NULL,
    "from_status" VARCHAR(20),
    "to_status" VARCHAR(20) NOT NULL,
    "changed_by" UUID,
    "changed_at" TIMESTAMPTZ(6),
    "reason" VARCHAR,

    CONSTRAINT "hazard_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hazards" (
    "id" UUID NOT NULL,
    "enterprise_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "content" VARCHAR,
    "description" VARCHAR,
    "location" VARCHAR(255),
    "category" VARCHAR(50),
    "inspection_method" VARCHAR(50),
    "inspector" VARCHAR(100),
    "inspection_date" DATE,
    "judgment_basis" VARCHAR(500),
    "violation_clause" VARCHAR,
    "is_rectified" VARCHAR(20),
    "rectification_date" DATE,
    "rectification_responsible" VARCHAR(200),
    "rectification_measures" VARCHAR,
    "report_remarks" VARCHAR,
    "reporting_unit" VARCHAR(100),
    "status" VARCHAR(20) NOT NULL,
    "current_task_id" UUID,
    "review_count" INTEGER,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "hazards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_errors" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "row_index" INTEGER NOT NULL,
    "raw_data" VARCHAR,
    "reason" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ(6),

    CONSTRAINT "import_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" VARCHAR(500),
    "related_type" VARCHAR(30),
    "related_id" UUID,
    "is_read" BOOLEAN NOT NULL,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photos" (
    "id" UUID NOT NULL,
    "task_hazard_id" UUID,
    "temp_token" VARCHAR(64),
    "original_path" VARCHAR(500) NOT NULL,
    "thumbnail_path" VARCHAR(500) NOT NULL,
    "file_size" BIGINT,
    "mime_type" VARCHAR(50),
    "width" INTEGER,
    "height" INTEGER,
    "uploaded_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "word_path" VARCHAR(500),
    "pdf_path" VARCHAR(500),
    "status" VARCHAR(20) NOT NULL,
    "error_message" VARCHAR,
    "generated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6),

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_tasks" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "creator_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "review_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statistics_daily" (
    "id" UUID NOT NULL,
    "stat_date" DATE NOT NULL,
    "enterprise_id" UUID,
    "batch_id" UUID,
    "inspector_id" UUID,
    "total_hazards" INTEGER,
    "pending_count" INTEGER,
    "passed_count" INTEGER,
    "failed_count" INTEGER,
    "review_count" INTEGER,
    "task_count" INTEGER,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "statistics_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statistics_monthly" (
    "id" UUID NOT NULL,
    "stat_month" VARCHAR(7) NOT NULL,
    "enterprise_id" UUID,
    "batch_id" UUID,
    "inspector_id" UUID,
    "total_hazards" INTEGER,
    "pending_count" INTEGER,
    "passed_count" INTEGER,
    "failed_count" INTEGER,
    "review_count" INTEGER,
    "task_count" INTEGER,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "statistics_monthly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_hazards" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "hazard_id" UUID NOT NULL,
    "conclusion" VARCHAR,
    "status_in_task" VARCHAR(20),
    "reviewed_at" TIMESTAMPTZ(6),
    "reviewer_id" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "task_hazards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "full_name" VARCHAR(100),
    "phone" VARCHAR(20),
    "password_hash" VARCHAR(255) NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ix_audit_logs_action" ON "audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "ix_audit_logs_target" ON "audit_logs"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "ix_audit_logs_user_created" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ix_hazards_batch_status" ON "hazards"("batch_id", "status");

-- CreateIndex
CREATE INDEX "ix_hazards_current_task" ON "hazards"("current_task_id");

-- CreateIndex
CREATE INDEX "ix_hazards_enterprise_status_created" ON "hazards"("enterprise_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "ix_import_errors_batch" ON "import_errors"("batch_id");

-- CreateIndex
CREATE INDEX "ix_notifications_read_at" ON "notifications"("read_at");

-- CreateIndex
CREATE INDEX "ix_notifications_related" ON "notifications"("related_type", "related_id");

-- CreateIndex
CREATE INDEX "ix_notifications_user_created" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ix_notifications_user_unread" ON "notifications"("user_id", "is_read", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uix_notification_user_type_related" ON "notifications"("user_id", "type", "related_id");

-- CreateIndex
CREATE INDEX "ix_photos_task_hazard" ON "photos"("task_hazard_id");

-- CreateIndex
CREATE INDEX "ix_photos_temp_token" ON "photos"("temp_token");

-- CreateIndex
CREATE UNIQUE INDEX "reports_task_id_key" ON "reports"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "uix_stats_daily" ON "statistics_daily"("stat_date", "enterprise_id", "batch_id", "inspector_id");

-- CreateIndex
CREATE UNIQUE INDEX "uix_stats_monthly" ON "statistics_monthly"("stat_month", "enterprise_id", "batch_id", "inspector_id");

-- CreateIndex
CREATE UNIQUE INDEX "uix_task_hazard" ON "task_hazards"("task_id", "hazard_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "hazard_status_history" ADD CONSTRAINT "hazard_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "hazard_status_history" ADD CONSTRAINT "hazard_status_history_hazard_id_fkey" FOREIGN KEY ("hazard_id") REFERENCES "hazards"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "hazards" ADD CONSTRAINT "hazards_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "hazards" ADD CONSTRAINT "hazards_current_task_id_fkey" FOREIGN KEY ("current_task_id") REFERENCES "review_tasks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "hazards" ADD CONSTRAINT "hazards_enterprise_id_fkey" FOREIGN KEY ("enterprise_id") REFERENCES "enterprises"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "import_errors" ADD CONSTRAINT "import_errors_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_task_hazard_id_fkey" FOREIGN KEY ("task_hazard_id") REFERENCES "task_hazards"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "review_tasks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "review_tasks" ADD CONSTRAINT "review_tasks_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "statistics_daily" ADD CONSTRAINT "statistics_daily_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "statistics_daily" ADD CONSTRAINT "statistics_daily_enterprise_id_fkey" FOREIGN KEY ("enterprise_id") REFERENCES "enterprises"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "statistics_daily" ADD CONSTRAINT "statistics_daily_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "statistics_monthly" ADD CONSTRAINT "statistics_monthly_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "statistics_monthly" ADD CONSTRAINT "statistics_monthly_enterprise_id_fkey" FOREIGN KEY ("enterprise_id") REFERENCES "enterprises"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "statistics_monthly" ADD CONSTRAINT "statistics_monthly_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "task_hazards" ADD CONSTRAINT "task_hazards_hazard_id_fkey" FOREIGN KEY ("hazard_id") REFERENCES "hazards"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "task_hazards" ADD CONSTRAINT "task_hazards_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "task_hazards" ADD CONSTRAINT "task_hazards_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "review_tasks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

┌─────────────────────────────────────────────────────────┐
│  Update available 5.22.0 -> 7.8.0                       │
│                                                         │
│  This is a major update - please follow the guide at    │
│  https://pris.ly/d/major-version-upgrade                │
│                                                         │
│  Run the following to update                            │
│    npm i --save-dev prisma@latest                       │
│    npm i @prisma/client@latest                          │
└─────────────────────────────────────────────────────────┘
