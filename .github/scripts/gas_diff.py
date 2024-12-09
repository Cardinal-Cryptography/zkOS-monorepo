import re
from prettytable import PrettyTable

def parse_report(file_path):
    data = {}
    with open(file_path, 'r') as file:
        for line in file:
            match = re.match(r'(\w+):\s*(\d+)', line)
            if match:
                name, value = match.groups()
                data[name] = int(value)
    return data

def calculate_differences(main_data, current_data):
    differences = []
    for name in main_data:
        main_value = main_data[name]
        current_value = current_data.get(name, 0)
        if main_value > 0:
            difference = ((current_value - main_value) / main_value) * 100
        else:
            difference = 0  # handle the case where main value is zero
        differences.append((name, main_value, current_value, difference))
    return differences

def generate_ascii_report(differences):
    # Create an ASCII table
    table = PrettyTable()
    table.field_names = ["Transaction Name", "Main", "Current", "Difference (%)"]

    for name, main, current, diff in differences:
        sign = '+' if diff > 0 else '-' if diff < 0 else ''
        formatted_diff = f"{sign}{abs(diff):.2f}"
        if diff > 0:
            table.add_row([name, main, current, formatted_diff])
        elif diff < 0:
            table.add_row([name, main, current, formatted_diff])
        else:
            table.add_row([name, main, current, f"{formatted_diff}"])

    return str(table)

def main():
    main_report_path = 'main-report.txt'
    current_report_path = 'current-report.txt'

    main_data = parse_report(main_report_path)
    current_data = parse_report(current_report_path)
    differences = calculate_differences(main_data, current_data)

    ascii_report = generate_ascii_report(differences)

    # Print the ASCII report
    print(ascii_report)

if __name__ == "__main__":
    main()
