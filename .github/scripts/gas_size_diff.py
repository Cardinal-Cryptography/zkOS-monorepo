import re


def parse_report(file_path, annotation):
    data = {}
    with open(file_path, 'r') as file:
        for line in file:
            match = re.match(r'(\w+):\s*(\d+)', line)
            if match:
                name, value = match.groups()
                data[f'{name} {annotation}'] = int(value)
    return data


def calculate_differences(main_data, current_data):
    differences = []
    for name in main_data:
        main_value = main_data[name]
        current_value = current_data.get(name, 0)
        if main_value > 0:
            difference = ((current_value - main_value) / main_value) * 100
        else:
            difference = 0  # handle case where main value is zero
        differences.append((name, main_value, current_value, difference))
    return differences


def generate_html_report(differences):
    # Generate single-line HTML content without formatting
    html_content = "<table><tr><th>Transaction Name</th><th>Main</th><th>Current</th><th>Difference (%)</th></tr>"
    for name, main, current, diff in differences:
        sign = '+' if diff > 0 else '-' if diff < 0 else ''
        diff_value = f"{sign}{abs(diff):.5f}%"
        html_content += f"<tr><td>{name}</td><td>{main}</td><td>{current}</td><td>{diff_value}</td></tr>"
    html_content += "</table>"
    return html_content


def main():
    main_gas_data = parse_report('main-gas.txt', '(gas)')
    current_gas_data = parse_report('current-gas.txt', '(gas)')
    main_size_data = parse_report('main-size.txt', '(size)')
    current_size_data = parse_report('current-size.txt', '(size)')

    differences = calculate_differences(
        main_gas_data | main_size_data,
        current_gas_data | current_size_data
    )

    html_report = generate_html_report(differences)

    with open('report.html', 'w') as report_file:
        report_file.write(html_report)


if __name__ == "__main__":
    main()
