import sqlite3
import pandas as pd
import logging
import sys

csv_file = "../missions.csv"
db_file = "missions.db"
table_name = "MISSIONS"

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

try:
    logging.info(f"Loading data from {csv_file}...")
    df = pd.read_csv(csv_file)
    logging.info(f"Successfully loaded {len(df)} rows from CSV.")

    logging.info(f"Connecting to database {db_file}...")
    with sqlite3.connect(db_file) as conn:
        logging.info(f"Creating table '{table_name}' if it doesn't exist...")
        columns_with_types = ", ".join([f"`{col}` TEXT" for col in df.columns])
        create_table_query = f"CREATE TABLE IF NOT EXISTS `{table_name}` ({columns_with_types})"
        conn.execute(create_table_query)

        logging.info(f"Writing data to table '{table_name}' (replacing existing data)...")
        df.to_sql(table_name, conn, if_exists="replace", index=False)
        logging.info(f"Data successfully written to table '{table_name}'.")

    logging.info(f"Database operation complete. Connection closed.")
    print(f"CSV data successfully processed and stored in {db_file}")

except FileNotFoundError:
    logging.error(f"Error: CSV file not found at {csv_file}")
    print(f"Error: Could not find the CSV file at {csv_file}. Please ensure it exists.", file=sys.stderr)
    sys.exit(1)
except pd.errors.EmptyDataError:
    logging.error(f"Error: CSV file {csv_file} is empty.")
    print(f"Error: The CSV file {csv_file} is empty.", file=sys.stderr)
    sys.exit(1)
except sqlite3.Error as e:
    logging.error(f"Database error: {e}")
    print(f"Error interacting with the database: {e}", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    logging.error(f"An unexpected error occurred: {e}", exc_info=True)
    print(f"An unexpected error occurred: {e}", file=sys.stderr)
    sys.exit(1)
